import { describe, expect, it } from "vitest";
import type { Contract, Market } from "@/lib/types";
import type { VenueAdapter } from "@/lib/venues/types";
import { paperPortfolio } from "./paper";
import type { HedgeRecord } from "./store";

const contract = (symbol: string, resolutionSide: "yes" | "no" | null, noBid: number | null = 0.3): Contract => ({
  venue: "fake",
  symbol,
  label: symbol,
  marketId: "M",
  marketTitle: "BTC price on November 17?",
  category: "Crypto",
  expiry: "2026-11-17T22:00:00Z",
  quote: { yesBid: null, yesAsk: null, noBid, noAsk: null, last: null },
  increments: { quantityIncrement: 0.01, quantityMinimum: 0.01, priceIncrement: 0.01, priceMinimum: 0.01 },
  rulesText: "",
  tradable: resolutionSide === null,
  resolutionSide,
});

function venue(contracts: Contract[]): VenueAdapter {
  const m: Market = { venue: "fake", id: "M", ticker: "M", title: "BTC price on November 17?", category: "Crypto", expiry: "2026-11-17T22:00:00Z", contracts };
  return {
    name: "gemini",
    listMarkets: async () => [m],
    getMarket: async () => m,
    placeOrder: async () => { throw new Error("no"); },
    cancelOrder: async () => {},
    getActiveOrders: async () => [],
    getPositions: async () => [],
  };
}

const hedge = (id: string, legs: { symbol: string; qty: number; price: number }[]): HedgeRecord => ({
  id,
  createdAt: 0,
  segment: "crypto",
  title: id,
  venue: "gemini",
  mode: "paper",
  totalCost: legs.reduce((s, l) => s + l.qty * l.price, 0),
  maxPayout: legs.reduce((s, l) => s + l.qty, 0),
  status: "placed",
  orders: legs.map((l) => ({ marketId: "M", symbol: l.symbol, outcome: "no", quantity: l.qty, limitPrice: l.price, fillPrice: l.price, orderId: "p", status: "filled", error: null })),
});

describe("paperPortfolio", () => {
  it("settles winning and losing legs from Gemini's resolution", async () => {
    // BTC ended at 64,265: "$65k or above" resolved NO (our NO wins), "$60k or above" resolved YES (our NO loses).
    const v = venue([contract("HI65000", "no"), contract("HI60000", "yes")]);
    const h = hedge("h1", [{ symbol: "HI65000", qty: 1000, price: 0.2 }, { symbol: "HI60000", qty: 500, price: 0.1 }]);
    const p = await paperPortfolio(v, [h]);
    expect(p.open).toHaveLength(0);
    expect(p.settled.map((x) => x.payout).sort()).toEqual([0, 1000]);
    expect(p.outcomes.h1).toEqual({ settled: true, payout: 1000, net: 1000 - 250 });
  });

  it("keeps unresolved legs open, marked to the live bid", async () => {
    const v = venue([contract("HI65000", null, 0.3)]);
    const p = await paperPortfolio(v, [hedge("h2", [{ symbol: "HI65000", qty: 100, price: 0.2 }])]);
    expect(p.open[0].marketValue).toBeCloseTo(30);
    expect(p.outcomes.h2).toEqual({ settled: false, payout: 0, net: null });
  });
});
