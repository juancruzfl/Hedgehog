import { describe, expect, it } from "vitest";
import gameEvent from "@/fixtures/gemini/game-event.json";
import type { AIProvider } from "@/lib/ai/types";
import type { Contract, Market, RiskProfile } from "@/lib/types";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import type { VenueAdapter } from "@/lib/venues/types";
import { analyzeRisk, impliedMedian, pickPriceMarket } from "./analyze";

const now = new Date("2026-11-17T09:00:00Z");

const strike = (k: number, mid: number): Contract => ({
  venue: "fake",
  symbol: `GEMI-WTI-HI${k}`,
  label: `$${k} or above`,
  marketId: "WTI2611202200",
  marketTitle: "Oil (WTI) price on November 20?",
  category: "Commodities",
  expiry: "2026-11-20T22:00:00.000Z",
  strike: { type: "above", value: k },
  quote: { yesBid: mid - 0.01, yesAsk: mid + 0.01, noBid: null, noAsk: null, last: null },
  increments: { quantityIncrement: 0.01, quantityMinimum: 0.01, priceIncrement: 0.01, priceMinimum: 0.01 },
  rulesText: "",
  tradable: true,
});

const market = (id: string, title: string, expiry: string, contracts: Contract[]): Market => ({ venue: "fake", id, ticker: id, title, category: "Commodities", expiry, contracts });

function venueWith(markets: Market[]): VenueAdapter {
  return {
    name: "fake",
    listMarkets: async () => markets,
    getMarket: async (id) => markets.find((m) => m.id === id) ?? null,
    placeOrder: async () => { throw new Error("no"); },
    cancelOrder: async () => {},
    getActiveOrders: async () => [],
    getPositions: async () => [],
  };
}

const baseProfile = (over: Partial<RiskProfile>): RiskProfile => ({
  id: "p",
  segment: "business",
  kind: "event_trigger",
  underlying: { type: "sports", ref: "Indianapolis vs Houston" },
  condition: "Indianapolis wins",
  exposureUsd: { low: 2400, expected: 3000, high: 3600 },
  window: { start: "2026-11-19T00:00:00Z", end: "2026-11-21T00:00:00Z" },
  source: "conversation",
  ...over,
});

describe("impliedMedian", () => {
  it("interpolates where YES odds cross 50%", () => {
    expect(impliedMedian([strike(80, 0.8), strike(82, 0.6), strike(84, 0.4), strike(86, 0.2)])).toBeCloseTo(83);
  });
  it("falls back to the edge when odds never cross", () => {
    expect(impliedMedian([strike(80, 0.9), strike(82, 0.7)])).toBe(82);
    expect(impliedMedian([])).toBeNull();
  });
});

describe("pickPriceMarket", () => {
  const ms = [
    market("A", "Oil (WTI) price on November 17?", "2026-11-17T22:00:00.000Z", []),
    market("B", "Oil (WTI) price on November 20?", "2026-11-20T22:00:00.000Z", []),
    market("C", "Gold price on November 30?", "2026-11-30T22:00:00.000Z", []),
  ];
  it("picks the first expiry that covers the window", () => {
    expect(pickPriceMarket(ms, "Oil (WTI) price on", "2026-11-19T00:00:00Z", now)).toMatchObject({ market: { id: "B" }, covers: true });
  });
  it("counts a market settling on the window's last day as covering it", () => {
    expect(pickPriceMarket(ms, "Oil (WTI) price on", "2026-11-20T23:59:00Z", now)).toMatchObject({ market: { id: "B" }, covers: true });
  });

  it("falls back to the latest one and says it doesn't cover", () => {
    expect(pickPriceMarket(ms, "Oil (WTI) price on", "2026-12-15T00:00:00Z", now)).toMatchObject({ market: { id: "B" }, covers: false });
  });
});

describe("analyzeRisk", () => {
  const noAI = {} as AIProvider;

  it("handles price risks without AI, using the market-implied spot", async () => {
    const wti = market("WTI2611202200", "Oil (WTI) price on November 20?", "2026-11-20T22:00:00.000Z", [strike(80, 0.8), strike(82, 0.6), strike(84, 0.4)]);
    const profile = baseProfile({ kind: "price_rise", underlying: { type: "commodity", ref: "WTI" }, position: { asset: "WTI", quantity: 50, spotPrice: 0 } });
    const a = await analyzeRisk(profile, { venue: venueWith([wti]), ai: noAI, now });
    expect(a.type).toBe("price");
    if (a.type === "price") expect(a.spot).toBeCloseTo(83);
  });

  it("says so when there's no market for the underlying", async () => {
    const a = await analyzeRisk(baseProfile({ kind: "price_rise", underlying: { type: "commodity", ref: "Coffee" } }), { venue: venueWith([]), ai: noAI, now });
    expect(a.type).toBe("none");
  });

  it("matches events through the AI and keeps only real candidates", async () => {
    const markets = toMarkets(gameEvent as GeminiEvent).map((m) => ({ ...m, expiry: "2026-11-18T05:00:00.000Z" }));
    const target = markets[0].contracts[0];
    const ai: AIProvider = {
      name: "fake",
      parseRisk: async () => { throw new Error("unused"); },
      searchPlan: async () => ({ categories: ["Sports"], terms: ["Mississippi State"] }),
      rankMarkets: async (_p, cands) => {
        expect(cands.length).toBeGreaterThan(0);
        return [{ symbol: target.symbol, outcome: "yes", quality: "exact", rationale: "same game", ruleMismatches: [] }];
      },
    };
    const a = await analyzeRisk(baseProfile({ window: { start: "2026-11-17T00:00:00Z", end: "2026-11-18T00:00:00Z" } }), { venue: venueWith(markets), ai, now });
    expect(a.type).toBe("event");
    if (a.type === "event") expect(a.matches[0].contract.symbol).toBe(target.symbol);
  });
});
