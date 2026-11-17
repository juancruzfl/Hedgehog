import { describe, expect, it } from "vitest";
import type { Contract, Market, Order, OrderRequest } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { executeHedge, type ApprovedHedge } from "./execute";
import { listHedges } from "./store";

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
});
