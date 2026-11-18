import type { Contract, Market, Position } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { listHedges, type HedgeRecord } from "./store";

// Paper portfolio: filled paper orders, marked to the live production bid while open,
// and settled from Gemini's own resolution once the market resolves.

/** One order of a hedge, described for people rather than for the exchange. */
export interface HedgeLegView {
  market: string; // e.g. "Indianapolis vs Houston"
  label: string; // e.g. "Indianapolis"
  outcome: string; // yes | no
  quantity: number;
  price: number; // paid per contract
  expiry: string | null;
  payout: number | null; // once resolved
}

export interface HedgeOutcome {
  settled: boolean; // every leg has resolved
  payout: number; // $ paid by resolved legs so far
  net: number | null; // payout - cost, once fully settled
  /** What the hedge is worth right now: resolved payouts plus open legs at the live bid. Null if a leg has no bid. */
  worthNow: number | null;
  /** When the last leg settles. */
  settlesAt: string | null;
  legs: HedgeLegView[];
}

export interface PaperPortfolio {
  open: Position[];
  settled: Position[];
  outcomes: Record<string, HedgeOutcome>;
}

const legPayout = (c: Contract | undefined, outcome: string, qty: number) =>
  c?.resolutionSide ? (c.resolutionSide === outcome ? qty : 0) : null;

export async function paperPortfolio(venue: VenueAdapter, hedges: HedgeRecord[] = listHedges()): Promise<PaperPortfolio> {
  const paper = hedges.filter((h) => h.mode === "paper");
  const fills = paper.flatMap((h) => h.orders.filter((o) => o.status === "filled"));

  // One lookup per market; getMarket returns settled markets too.
  const marketIds = [...new Set(fills.map((o) => o.marketId))];
  const markets = new Map<string, Market | null>(
    await Promise.all(marketIds.map(async (id) => [id, await venue.getMarket(id).catch(() => null)] as const)),
  );
  const contractFor = (marketId: string, symbol: string) => markets.get(marketId)?.contracts.find((c) => c.symbol === symbol);

  // Per-hedge outcome.
  const outcomes: Record<string, HedgeOutcome> = {};
  for (const h of paper) {
    const legs = h.orders.filter((o) => o.status === "filled");
    const payouts = legs.map((o) => legPayout(contractFor(o.marketId, o.symbol), o.outcome, o.quantity));
    const settled = legs.length > 0 && payouts.every((p) => p !== null);
    const payout = payouts.reduce<number>((s, p) => s + (p ?? 0), 0);
    let worthNow: number | null = 0;
    const views: HedgeLegView[] = legs.map((o, k) => {
      const c = contractFor(o.marketId, o.symbol);
      const m = markets.get(o.marketId);
      const bid = c ? (o.outcome === "yes" ? c.quote.yesBid : c.quote.noBid) : null;
      const value = payouts[k] ?? (bid === null ? null : o.quantity * bid);
      worthNow = worthNow === null || value === null ? null : worthNow + value;
      return {
        market: m?.title.replace(/\?$/, "") ?? o.marketId,
        label: c?.label ?? o.symbol,
        outcome: o.outcome,
        quantity: o.quantity,
        price: o.fillPrice ?? o.limitPrice,
        expiry: c?.expiry ?? m?.expiry ?? null,
        payout: payouts[k],
      };
    });
    const settlesAt = views.map((v) => v.expiry).filter((x): x is string => !!x).sort().at(-1) ?? null;
    outcomes[h.id] = { settled, payout, net: settled ? payout - h.totalCost : null, worthNow, settlesAt, legs: views };
  }

  // Positions grouped by contract + side.
  const grouped = new Map<string, { marketId: string; symbol: string; outcome: "yes" | "no"; qty: number; cost: number }>();
  for (const o of fills) {
    const key = `${o.symbol}:${o.outcome}`;
    const g = grouped.get(key) ?? { marketId: o.marketId, symbol: o.symbol, outcome: o.outcome as "yes" | "no", qty: 0, cost: 0 };
    g.qty += o.quantity;
    g.cost += o.quantity * (o.fillPrice ?? o.limitPrice);
    grouped.set(key, g);
  }

  const open: Position[] = [];
  const settled: Position[] = [];
  for (const g of grouped.values()) {
    const m = markets.get(g.marketId);
    const c = contractFor(g.marketId, g.symbol);
    const payout = legPayout(c, g.outcome, g.qty);
    const bid = c ? (g.outcome === "yes" ? c.quote.yesBid : c.quote.noBid) : null;
    const marketValue = payout ?? (bid === null ? null : g.qty * bid);
    const pos: Position = {
      venue: `${venue.name} (paper)`,
      symbol: g.symbol,
      outcome: g.outcome,
      quantity: g.qty,
      avgPrice: g.cost / g.qty,
      marketValue,
      unrealizedPnl: marketValue === null ? null : marketValue - g.cost,
      resolutionSide: c?.resolutionSide ?? null,
      marketTitle: m ? `${m.title.replace(/\?$/, "")}: ${c?.label ?? g.symbol}` : g.symbol,
      expiry: c?.expiry ?? m?.expiry,
      payout,
    };
    (payout === null ? open : settled).push(pos);
  }
  return { open, settled, outcomes };
}
