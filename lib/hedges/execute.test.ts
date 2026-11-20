import { describe, expect, it } from "vitest";
import type { Contract, Market, Order, OrderRequest } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { executeHedge, type ApprovedHedge } from "./execute";
import { getReceipt, listHedges } from "./store";
import { sha256, type ReceiptDocument } from "./receipt";
import { historyForSymbol, watchedMarketIds } from "@/lib/odds/store";

const contract = (noAsk: number | null, tradable = true): Contract => ({
  venue: "fake",
  symbol: "GEMI-SOL-HI65",
  label: "$65 or above",
  marketId: "SOL",
  marketTitle: "SOL price on November 30",
  category: "Crypto",
  expiry: "2026-11-30T22:00:00Z",
  strike: { type: "above", value: 65 },
  quote: { yesBid: null, yesAsk: null, noBid: null, noAsk, last: null },
  increments: { quantityIncrement: 0.01, quantityMinimum: 0.01, priceIncrement: 0.01, priceMinimum: 0.01 },
  rulesText: "",
  tradable,
});

function fakeVenue(c: Contract, placed: OrderRequest[] = []): VenueAdapter {
  const market: Market = { venue: "fake", id: "SOL", ticker: "SOL", title: c.marketTitle, category: "Crypto", expiry: c.expiry, contracts: [c] };
  return {
    name: "fake",
    listMarkets: async () => [market],
    getMarket: async () => market,
    placeOrder: async (o) => {
      placed.push(o);
      return { venue: "fake", orderId: "1", symbol: o.symbol, side: o.side, outcome: o.outcome, status: "open", quantity: o.quantity, filledQuantity: 0, limitPrice: o.limitPrice, avgExecutionPrice: null, createdAt: "" } satisfies Order;
    },
    cancelOrder: async () => {},
    getActiveOrders: async () => [],
    getPositions: async () => [],
  };
}

const hedge = (limitPrice: number, quantity = 100): ApprovedHedge => ({
  title: "Protect SOL",
  segment: "crypto",
  profile: null,
  legs: [{ marketId: "SOL", symbol: "GEMI-SOL-HI65", outcome: "no", quantity, limitPrice }],
});

describe("executeHedge", () => {
  it("paper-fills at the live ask (which may be better than approved)", async () => {
    const r = await executeHedge(fakeVenue(contract(0.18)), hedge(0.2), "paper");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results[0]).toMatchObject({ status: "filled", fillPrice: 0.18 });
    expect(listHedges().find((h) => h.id === r.hedgeId)?.totalCost).toBe(18);
  });

  it("refuses when the price moved above what the user approved", async () => {
    const placed: OrderRequest[] = [];
    const r = await executeHedge(fakeVenue(contract(0.25), placed), hedge(0.2), "live");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toContain("price moved");
    expect(placed).toHaveLength(0);
  });

  it("refuses untradable markets and missing offers", async () => {
    expect((await executeHedge(fakeVenue(contract(0.2, false)), hedge(0.2), "paper")).ok).toBe(false);
    expect((await executeHedge(fakeVenue(contract(null)), hedge(0.2), "paper")).ok).toBe(false);
  });

  it("enforces the per-hedge spend cap", async () => {
    await expect(executeHedge(fakeVenue(contract(0.5)), hedge(0.5, 20000), "paper")).rejects.toThrow(/limit per hedge/);
  });

  it("places real limit orders at the approved price in live mode", async () => {
    const placed: OrderRequest[] = [];
    const r = await executeHedge(fakeVenue(contract(0.18), placed), hedge(0.2), "live");
    expect(r.ok).toBe(true);
    expect(placed[0]).toMatchObject({ side: "buy", outcome: "no", quantity: 100, limitPrice: 0.2 });
  });

  it("issues a receipt: the exact document, its SHA-256, and the quotes it was checked against", async () => {
    const r = await executeHedge(fakeVenue(contract(0.18)), { ...hedge(0.2), profile: { promo: "half-price wings" } }, "paper");
    if (!r.ok) throw new Error("expected ok");
    const rec = getReceipt(r.hedgeId)!;
    expect(rec.sha256).toBe(sha256(rec.document));
    expect(rec.signature).toBeNull(); // sealing is off in tests
    const doc = JSON.parse(rec.document) as ReceiptDocument;
    expect(doc).toMatchObject({ type: "hedgehog-hedge-receipt", v: 1, hedgeId: r.hedgeId, mode: "paper", totalCost: 18, maxPayout: 100 });
    expect(doc.termsSha256).toBe(sha256(JSON.stringify({ promo: "half-price wings" })));
    expect(rec.document).not.toContain("half-price wings"); // terms only as a fingerprint
    expect(doc.orders[0]).toMatchObject({ symbol: "GEMI-SOL-HI65", status: "filled", fillPrice: 0.18 });
    // The quote it used went into the odds archive, and the market is now tracked.
    const seen = doc.oddsSeen[0];
    expect(historyForSymbol("GEMI-SOL-HI65").some((p) => p.ts === seen.ts)).toBe(true);
    expect(watchedMarketIds()).toContain("SOL");
  });

  it("issues no receipt when nothing was placed", async () => {
    const venue = fakeVenue(contract(0.18));
    venue.placeOrder = async () => {
      throw new Error("rejected");
    };
    const r = await executeHedge(venue, hedge(0.2), "live");
    if (!r.ok) throw new Error("expected ok");
    expect(getReceipt(r.hedgeId)).toBeNull();
  });
});
