import { describe, expect, it } from "vitest";
import btcEvent from "@/fixtures/gemini/btc-event.json";
import gameEvent from "@/fixtures/gemini/game-event.json";
import { buildDownsideLadder } from "@/lib/engine/sizer";
import type { RiskProfile } from "@/lib/types";
import { toMarkets, type GeminiEvent } from "./normalize";

// Fixtures are real responses from GET /v1/prediction-markets/events (captured 2026-11-17).

describe("toMarkets", () => {
  it("normalizes crypto strike contracts", () => {
    const [m] = toMarkets(btcEvent as GeminiEvent);
    expect(m.category).toBe("Crypto");
    const c = m.contracts[0];
    expect(c.symbol.startsWith("GEMI-")).toBe(true);
    expect(c.strike).toEqual({ type: "above", value: 61000 });
    expect(c.quote.yesAsk).not.toBeNull();
    expect(c.quote.noAsk).not.toBeNull();
    expect(c.rulesText).toContain("will resolve to Yes");
    expect(c.increments.quantityIncrement).toBe(0.01);
  });

  it("flattens game events and their child markets", () => {
    const markets = toMarkets(gameEvent as GeminiEvent);
    expect(markets.length).toBeGreaterThan(1);
    expect(markets[0].title).toBe("Mississippi State vs UCF");
    expect(markets.some((m) => m.title.includes("Point Spread"))).toBe(true);
    expect(markets.every((m) => m.category === "Sports")).toBe(true);
  });

  it("feeds the ladder builder end to end", () => {
    const [m] = toMarkets(btcEvent as GeminiEvent);
    const strikes = m.contracts.map((c) => c.strike!.value!).sort((a, b) => a - b);
    const spot = strikes[Math.floor(strikes.length * 0.7)];
    const profile: RiskProfile = {
      id: "t",
      segment: "crypto",
      kind: "price_drop",
      underlying: { type: "crypto", ref: "BTC" },
      condition: "BTC drop",
      exposureUsd: { low: 0, expected: 0, high: 0 },
      window: { start: "2026-11-17T00:00:00Z", end: m.expiry },
      source: "manual",
      position: { asset: "BTC", quantity: 1, spotPrice: spot },
    };
    const r = buildDownsideLadder(profile, m.contracts, { startDrop: 0.01, floorDrop: 0.08 });
    expect(r.legs.length).toBeGreaterThan(0);
    expect(r.totalCost).toBeGreaterThan(0);
  });
});

describe("order id precision", () => {
  it("keeps 18-digit order ids exact when parsing responses", async () => {
    const { parseKeepingIds } = await import("./client");
    const body = parseKeepingIds('{"orderId":145853902320789950,"status":"open","quantity":"1"}') as { orderId: string };
    expect(body.orderId).toBe("145853902320789950");
    // Plain JSON.parse rounds to the nearest double: ...789953 comes back as ...789952.
    expect(String(BigInt(JSON.parse('{"orderId":145853902320789953}').orderId))).not.toBe("145853902320789953");
    expect((parseKeepingIds('{"orderId":145853902320789953}') as { orderId: string }).orderId).toBe("145853902320789953");
  });
});
