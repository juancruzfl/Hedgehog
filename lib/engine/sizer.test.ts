import { describe, expect, it } from "vitest";
import type { Contract, RiskProfile } from "@/lib/types";
import { buildDownsideLadder, ladderCandidates, payoffCurve, roundQuantity, sizeEventHedge } from "./sizer";

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    venue: "gemini",
    symbol: "GEMI-TEST",
    label: "Test",
    marketId: "TEST",
    marketTitle: "Test market",
    category: "Sports",
    expiry: "2026-11-20T22:00:00.000Z",
    quote: { yesBid: 0.38, yesAsk: 0.4, noBid: 0.58, noAsk: 0.62, last: 0.39 },
    increments: { quantityIncrement: 0.01, quantityMinimum: 0.01, priceIncrement: 0.01, priceMinimum: 0.01 },
    rulesText: "",
    tradable: true,
    ...overrides,
  };
}

const btcStrike = (k: number, noAsk: number): Contract =>
  contract({
    symbol: `GEMI-BTC-HI${k}`,
    label: `$${k} or above`,
    category: "Crypto",
    strike: { type: "above", value: k },
    quote: { yesBid: 1 - noAsk - 0.02, yesAsk: 1 - noAsk + 0.02, noBid: noAsk - 0.02, noAsk, last: null },
  });

const promoProfile: RiskProfile = {
  id: "promo-1",
  segment: "business",
  kind: "event_trigger",
  underlying: { type: "sports", ref: "Indianapolis vs Houston" },
  condition: "Indianapolis wins",
  exposureUsd: { low: 2400, expected: 3000, high: 3600 },
  window: { start: "2026-11-17T00:00:00Z", end: "2026-11-20T00:00:00Z" },
  source: "conversation",
};

describe("roundQuantity", () => {
  it("rounds down to the increment", () => {
    expect(roundQuantity(10.239, contract())).toBe(10.23);
    expect(roundQuantity(7.9, contract({ increments: { ...contract().increments, quantityIncrement: 1 } }))).toBe(7);
  });
});

describe("sizeEventHedge", () => {
  it("turns a promo into a fixed cost when fully hedged at the expected exposure", () => {
    const r = sizeEventHedge(promoProfile, contract(), "yes");
    expect(r.legs[0].quantity).toBe(3000);
    expect(r.totalCost).toBe(1200);
    expect(r.maxPayout).toBe(3000);
    const expected = r.scenarios.find((s) => s.exposure === "expected")!;
    expect(expected.ifTriggered).toBe(-1200);
    expect(expected.ifNotTriggered).toBe(-1200);
    // Turnout risk stays unhedged
    expect(r.scenarios.find((s) => s.exposure === "high")!.ifTriggered).toBe(-1800);
  });

  it("supports partial hedges", () => {
    const r = sizeEventHedge(promoProfile, contract(), "yes", { hedgeRatio: 0.5 });
    expect(r.legs[0].quantity).toBe(1500);
    expect(r.totalCost).toBe(600);
  });

  it("returns no legs when there is no offer", () => {
    const c = contract({ quote: { yesBid: null, yesAsk: null, noBid: null, noAsk: null, last: null } });
    const r = sizeEventHedge(promoProfile, c, "yes");
    expect(r.legs).toHaveLength(0);
    expect(r.warnings.some((w) => w.includes("No ask"))).toBe(true);
  });

  it("warns when the outcome is near-certain", () => {
    const c = contract({ quote: { yesBid: 0.9, yesAsk: 0.93, noBid: 0.06, noAsk: 0.08, last: 0.92 } });
    expect(sizeEventHedge(promoProfile, c, "yes").warnings.some((w) => w.includes("93%"))).toBe(true);
  });
});

describe("buildDownsideLadder", () => {
  const holder: RiskProfile = {
    id: "btc-1",
    segment: "crypto",
    kind: "price_drop",
    underlying: { type: "crypto", ref: "BTC" },
    condition: "BTC falls more than 5%",
    exposureUsd: { low: 0, expected: 0, high: 0 },
    window: { start: "2026-11-17T00:00:00Z", end: "2026-11-20T22:00:00Z" },
    source: "wallet",
    position: { asset: "BTC", quantity: 2, spotPrice: 64000 },
  };
  // Strikes every $1000 from 50k to 66k; NO gets cheaper further below spot.
  const strikes = Array.from({ length: 17 }, (_, i) => 50000 + i * 1000).map((k) =>
    btcStrike(k, Math.max(0.02, Math.min(0.97, (k - 50000) / 16000))),
  );

  it("only uses tradable 'above' strikes with a NO offer", () => {
    const junk = [contract({ strike: { type: "spread", value: 3 } }), btcStrike(60000, 0.3)];
    junk[1].tradable = false;
    expect(ladderCandidates(junk)).toHaveLength(0);
  });

  it("builds legs inside the band, sized by strike spacing", () => {
    const r = buildDownsideLadder(holder, strikes, { startDrop: 0.05, floorDrop: 0.25, maxLegs: 4 });
    const ks = r.legs.map((l) => l.contract.strike!.value);
    expect(ks.every((k) => k! <= 64000 * 0.95 && k! > 64000 * 0.75)).toBe(true);
    expect(ks).toEqual([...ks].sort((a, b) => b! - a!));
    expect(r.legs.every((l) => l.outcome === "no")).toBe(true);
    // Total payout ~= Q * (top strike - floor)
    expect(r.maxPayout).toBeCloseTo(2 * (ks[0]! - 64000 * 0.75), 0);
  });

  it("payout covers the loss measured from the top strike, within the band", () => {
    const r = buildDownsideLadder(holder, strikes, { startDrop: 0.05, floorDrop: 0.25 });
    const top = r.legs[0].contract.strike!.value!;
    for (const pt of payoffCurve(holder, r, 120)) {
      if (pt.price < top && pt.price > r.floorPrice) {
        const payout = pt.hedged - pt.unhedged + r.totalCost;
        expect(payout + 1e-6).toBeGreaterThanOrEqual(2 * (top - pt.price));
      }
    }
  });

  it("narrows the floor instead of over-sizing the lowest strike when strikes are sparse", () => {
    const sparse = [btcStrike(60000, 0.18), btcStrike(57500, 0.11)];
    const r = buildDownsideLadder(holder, sparse, { startDrop: 0.05, floorDrop: 0.3 });
    expect(r.floorPrice).toBe(55000); // 57.5k - typical 2.5k spacing, not 64k * 0.7
    expect(r.legs.map((l) => l.quantity)).toEqual([5000, 5000]);
    expect(r.warnings.some((w) => w.includes("narrowed"))).toBe(true);
  });

  it("hedged P&L is better than unhedged in a crash and worse (by the cost) in a rally", () => {
    const r = buildDownsideLadder(holder, strikes);
    const curve = payoffCurve(holder, r);
    const crash = curve.find((p) => p.price < 64000 * 0.8)!;
    const rally = curve[curve.length - 1];
    expect(crash.hedged).toBeGreaterThan(crash.unhedged);
    expect(rally.unhedged - rally.hedged).toBeCloseTo(r.totalCost, 2);
  });
});
