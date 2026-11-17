import { describe, expect, it } from "vitest";
import btcEvent from "@/fixtures/gemini/btc-event.json";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import { buildForecast, changeSince, dailyPriceMarkets, probBelowSeries, yesMid } from "./forecast";

const markets = toMarkets(btcEvent as GeminiEvent); // "BTC price on November 20"
const now = new Date("2026-11-17T09:00:00Z");

describe("yesMid", () => {
  it("averages bid/ask and falls back sensibly", () => {
    expect(yesMid({ yesBid: 0.4, yesAsk: 0.5, last: 0.1 })).toBeCloseTo(0.45);
    expect(yesMid({ yesBid: null, yesAsk: 0.5, last: 0.1 })).toBe(0.5);
    expect(yesMid({ yesBid: null, yesAsk: null, last: 0.1 })).toBe(0.1);
    expect(yesMid({ yesBid: null, yesAsk: null, last: null })).toBeNull();
  });
});

describe("buildForecast", () => {
  it("finds daily price markets for the asset only", () => {
    expect(dailyPriceMarkets(markets, "BTC", now)).toHaveLength(1);
    expect(dailyPriceMarkets(markets, "ETH", now)).toHaveLength(0);
    expect(dailyPriceMarkets(markets, "BTC", new Date("2026-12-01T00:00:00Z"))).toHaveLength(0); // expired
  });

  it("produces downside odds that increase with smaller drops", () => {
    const f = buildForecast({ asset: "BTC", spot: 64500, quantity: 2, markets, now });
    expect(f.valueUsd).toBe(129000);
    const pts = f.horizons[0].points;
    expect(pts.length).toBeGreaterThan(1);
    for (const p of pts) {
      expect(p.strike).toBeLessThan(64500);
      expect(p.probBelow).toBeGreaterThanOrEqual(0);
      expect(p.probBelow).toBeLessThanOrEqual(1);
      expect(p.lossAtStrike).toBeCloseTo(2 * (64500 - p.strike));
    }
    // Deeper drop => lower probability
    const sorted = [...pts].sort((a, b) => a.drop - b.drop);
    expect(sorted[0].probBelow).toBeGreaterThanOrEqual(sorted[sorted.length - 1].probBelow);
  });
});

describe("odds history helpers", () => {
  const h = (ts: number, mid: number) => ({ ts, yesBid: mid - 0.01, yesAsk: mid + 0.01, last: null });
  it("converts YES quotes to P(below) and computes 24h change", () => {
    const day = 24 * 3600_000;
    const series = probBelowSeries([h(0, 0.9), h(day / 2, 0.85), h(day + 1000, 0.8)]);
    expect(series.map((p) => +p.probBelow.toFixed(2))).toEqual([0.1, 0.15, 0.2]);
    const ch = changeSince(series)!;
    expect(ch.from).toBeCloseTo(0.15); // nearest point within the last 24h
    expect(ch.delta).toBeCloseTo(0.05);
  });
  it("returns null without enough history", () => {
    expect(changeSince([])).toBeNull();
  });
});
