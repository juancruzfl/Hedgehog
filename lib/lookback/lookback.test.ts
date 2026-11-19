import { describe, expect, it } from "vitest";
import { eventName, hedgeCutoff, lookbackMath, pickReading, tickerTime, triggerPhrase } from "./lookback";

const H = 3600_000;

describe("tickerTime", () => {
  it("reads the UTC time in a Gemini ticker", () => {
    expect(tickerTime("NFL-2611200115-IND-HOU-M")).toBe(Date.UTC(2026, 10, 20, 1, 15));
    expect(tickerTime("WXHIGH-AUS-2611180459")).toBe(Date.UTC(2026, 10, 18, 4, 59));
  });
  it("returns null for tickers without a time", () => {
    expect(tickerTime("BTC-ABOVE")).toBeNull();
  });
});

describe("hedgeCutoff", () => {
  it("is kickoff for games", () => {
    expect(hedgeCutoff("NFL-2611200115-IND-HOU-M", "Sports")).toBe(Date.UTC(2026, 10, 20, 1, 15));
  });
  it("is 10 AM ET on the measured day for weather", () => {
    // Day ends 2026-11-18 04:59Z (11:59 PM ET Nov 17); 10 AM ET Nov 17 is 14:59Z.
    expect(hedgeCutoff("WXHIGH-AUS-2611180459", "Weather")).toBe(Date.UTC(2026, 10, 17, 14, 59));
  });
});

describe("pickReading", () => {
  const cutoff = 100 * H;
  const pts = [
    { ts: 10 * H, yesBid: 0.2, yesAsk: 0.22, last: null },
    { ts: 70 * H, yesBid: 0.3, yesAsk: null, last: null }, // no ask: skipped
    { ts: 75 * H, yesBid: 0.3, yesAsk: 0.31, last: null },
    { ts: 99 * H, yesBid: 0.4, yesAsk: 0.41, last: null },
    { ts: 101 * H, yesBid: 0.9, yesAsk: 0.95, last: null }, // after the cutoff: never used
  ];
  it("never uses a price from after the cutoff", () => {
    expect(pickReading(pts, cutoff, "last")?.yesAsk).toBe(0.41);
  });
  it("picks the earliest and the day-before readings", () => {
    expect(pickReading(pts, cutoff, "early")?.yesAsk).toBe(0.22);
    expect(pickReading(pts, cutoff, "day")?.yesAsk).toBe(0.31);
  });
  it("falls back to the earliest when the record starts less than a day out", () => {
    expect(pickReading(pts.slice(2), cutoff, "day")?.yesAsk).toBe(0.31);
  });
  it("returns null with nothing usable", () => {
    expect(pickReading(pts.slice(4), cutoff, "early")).toBeNull();
  });
});

describe("lookbackMath", () => {
  it("promo triggered: the hedge pays the promo back, minus what it cost", () => {
    const r = lookbackMath({ promoCost: 1200, price: 0.16, triggered: true });
    expect(r).toMatchObject({ contracts: 1200, hedgeCost: 192, payout: 1200, without: -1200, withHedge: -192, saved: 1008, worstWithHedge: -192 });
  });
  it("promo not triggered: the hedge cost is the only cost", () => {
    const r = lookbackMath({ promoCost: 1200, price: 0.16, triggered: false });
    expect(r).toMatchObject({ payout: 0, without: 0, withHedge: -192, saved: -192 });
  });
  it("not settled yet: no result, but the worst case is known", () => {
    const r = lookbackMath({ promoCost: 500, price: 0.5, triggered: null });
    expect(r.saved).toBeNull();
    expect(r.worstWithHedge).toBe(-250);
  });
  it("rounds down to the contract grid and counts the uncovered part in the worst case", () => {
    const r = lookbackMath({ promoCost: 1205, price: 0.1, triggered: true, quantityIncrement: 10 });
    expect(r.contracts).toBe(1200);
    expect(r.worstWithHedge).toBe(-125);
    expect(r.withHedge).toBe(-125);
  });
});

describe("wording", () => {
  it("phrases triggers", () => {
    expect(triggerPhrase("Sports", "Indianapolis")).toBe("Indianapolis won");
    expect(triggerPhrase("Weather", "70°F or above")).toBe("the high was 70°F or above");
    expect(triggerPhrase("Sports", "Draw", "future")).toBe("the game ends in a draw");
    expect(triggerPhrase("Sports", "Houston", "not")).toBe("Houston didn't win");
  });
  it("names weather events by city", () => {
    expect(eventName("Weather", "Highest temperature in Austin on November 17, 2026?")).toBe("Austin high temperature");
    expect(eventName("Sports", "Indianapolis vs Houston")).toBe("Indianapolis vs Houston");
  });
});
