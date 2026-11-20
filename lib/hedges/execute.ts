import { randomUUID } from "node:crypto";
import { z } from "zod";
import { askFor } from "@/lib/engine/sizer";
import type { Contract } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { SIGN_IN_EXPIRED, isSignInExpired } from "@/lib/auth/session";
import { insertSnapshot, rowFromContract, watchMarkets } from "@/lib/odds/store";
import { buildReceipt } from "./receipt";
import { addHedgeOrder, createHedge, saveReceipt, setHedgeStatus, type HedgeOrder } from "./store";

// Places the orders for a hedge the user approved. The server never trusts the
// client's numbers blindly: it re-reads live quotes, enforces a spend cap, and
// refuses if the price moved above what the user approved.
//
// Modes (HEDGE_EXECUTION):
//   paper (default): fills at the LIVE production ask, recorded locally. Used because
//                    Gemini's sandbox lists different strikes and has empty order books.
//   live:            real limit orders on the venue (GEMINI_TRADING_ENV decides where).

export type ExecutionMode = "paper" | "live";
export const executionMode = (): ExecutionMode => (process.env.HEDGE_EXECUTION === "live" ? "live" : "paper");
const maxSpend = () => Number(process.env.MAX_HEDGE_USD ?? 5000);

export const ApprovedHedge = z.object({
  title: z.string().min(1).max(200),
  segment: z.enum(["crypto", "business"]),
  profile: z.unknown(),
  legs: z
    .array(
      z.object({
        marketId: z.string().min(1),
        symbol: z.string().min(1),
        outcome: z.enum(["yes", "no"]),
        quantity: z.number().positive(),
        limitPrice: z.number().gt(0).lt(1), // the max per-contract price the user approved
      }),
    )
    .min(1)
    .max(10),
});
export type ApprovedHedge = z.infer<typeof ApprovedHedge>;

export interface LegResult {
  symbol: string;
  status: "filled" | "placed" | "rejected" | "skipped";
  orderId?: string;
  orderStatus?: string;
  fillPrice?: number;
  error?: string;
}

async function liveContracts(venue: VenueAdapter, marketIds: string[], mode: ExecutionMode) {
  const map = new Map<string, Contract>();
  for (const id of marketIds) {
    const m = mode === "live" && venue.getTradingMarket ? await venue.getTradingMarket(id) : await venue.getMarket(id);
    for (const c of m?.contracts ?? []) map.set(c.symbol, c);
  }
  return map;
}

export async function executeHedge(venue: VenueAdapter, hedge: ApprovedHedge, mode: ExecutionMode = executionMode()) {
  const total = hedge.legs.reduce((s, l) => s + l.quantity * l.limitPrice, 0);
  if (total > maxSpend()) {
    throw new Error(`This hedge costs up to $${total.toFixed(2)}, above the $${maxSpend()} limit per hedge.`);
  }

  // Re-validate every leg against live data before doing anything.
  const live = await liveContracts(venue, [...new Set(hedge.legs.map((l) => l.marketId))], mode);
  const problems: string[] = [];
  const asks = new Map<string, number>();
  for (const l of hedge.legs) {
    const c = live.get(l.symbol);
    if (!c) {
      problems.push(`${l.symbol}: not listed${mode === "live" ? " where orders are sent" : ""}`);
      continue;
    }
    if (!c.tradable) problems.push(`${c.label}: not open for trading`);
    const ask = askFor(c, l.outcome);
    if (ask === null) problems.push(`${c.label}: no one is selling ${l.outcome.toUpperCase()} right now`);
    else if (ask > l.limitPrice + 1e-9) problems.push(`${c.label}: price moved from $${l.limitPrice.toFixed(2)} to $${ask.toFixed(2)}`);
    else asks.set(l.symbol, ask);
    if (l.quantity < c.increments.quantityMinimum) problems.push(`${c.label}: below minimum size`);
  }
  if (problems.length) return { ok: false as const, problems };

  const id = randomUUID();
  const approvedAt = Date.now();
  // The quotes this hedge was checked against become archive readings (sealed with their
  // hour), and its markets keep being recorded until they settle.
  const seen = hedge.legs.map((l) => rowFromContract(approvedAt, live.get(l.symbol)!));
  try {
    insertSnapshot(seen);
    watchMarkets([...new Set(hedge.legs.map((l) => l.marketId))]);
  } catch (e) {
    console.error("[hedge] couldn't record the quotes it used:", (e as Error).message);
  }
  const totalCost = Math.round(hedge.legs.reduce((s, l) => s + l.quantity * asks.get(l.symbol)!, 0) * 100) / 100;
  const maxPayout = hedge.legs.reduce((s, l) => s + l.quantity, 0);
  const profileJson = JSON.stringify(hedge.profile ?? null);
  const orders: HedgeOrder[] = [];
  const record = (o: HedgeOrder) => {
    orders.push(o);
    addHedgeOrder(id, o);
  };
  // Receipt: written once orders are in, sealed on Solana in the background.
  const issueReceipt = () => {
    if (!orders.some((o) => o.status !== "rejected" && o.status !== "skipped")) return;
    const { document, sha256 } = buildReceipt({
      hedgeId: id,
      approvedAt: new Date(approvedAt).toISOString(),
      mode,
      venue: venue.name,
      segment: hedge.segment,
      title: hedge.title,
      profileJson,
      orders,
      totalCost,
      maxPayout,
      oddsSeen: seen,
    });
    saveReceipt(id, document, sha256);
    if (process.env.ARCHIVE_ANCHOR === "1") {
      void import("./seal").then(({ sealReceipt }) => sealReceipt(id)).catch((e) => console.error("[receipt]", (e as Error).message));
    }
  };

  createHedge({
    id,
    segment: hedge.segment,
    title: hedge.title,
    venue: venue.name,
    mode,
    totalCost,
    maxPayout,
    profileJson,
    status: "placing",
  });

  const results: LegResult[] = [];
  if (mode === "paper") {
    for (const l of hedge.legs) {
      const fillPrice = asks.get(l.symbol)!;
      const orderId = `paper-${randomUUID().slice(0, 8)}`;
      results.push({ symbol: l.symbol, status: "filled", orderId, fillPrice });
      record({ ...l, fillPrice, orderId, status: "filled", error: null });
    }
    setHedgeStatus(id, "placed");
    issueReceipt();
    return { ok: true as const, hedgeId: id, mode, results, partial: false };
  }

  // Live: place sequentially; stop at the first failure so the user isn't left with surprises.
  let failed = false;
  for (const l of hedge.legs) {
    if (failed) {
      results.push({ symbol: l.symbol, status: "skipped" });
      record({ ...l, fillPrice: null, orderId: null, status: "skipped", error: null });
      continue;
    }
    try {
      const order = await venue.placeOrder({ symbol: l.symbol, side: "buy", outcome: l.outcome, quantity: l.quantity, limitPrice: l.limitPrice });
      results.push({ symbol: l.symbol, status: "placed", orderId: order.orderId, orderStatus: order.status });
      record({ ...l, fillPrice: order.avgExecutionPrice, orderId: order.orderId, status: order.status, error: null });
    } catch (e) {
      failed = true;
      const error = isSignInExpired(e) ? SIGN_IN_EXPIRED : (e as Error).message;
      results.push({ symbol: l.symbol, status: "rejected", error });
      record({ ...l, fillPrice: null, orderId: null, status: "rejected", error });
    }
  }
  const placed = results.filter((r) => r.status === "placed").length;
  setHedgeStatus(id, failed ? (placed ? "partial" : "failed") : "placed");
  issueReceipt();
  return { ok: true as const, hedgeId: id, mode, results, partial: failed && placed > 0 };
}
