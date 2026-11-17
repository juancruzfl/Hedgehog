import { describe, expect, it } from "vitest";
import type { Contract, RiskProfile } from "@/lib/types";
import { OpenAICompatibleProvider } from "./openai-compatible";

// Fake chat client that returns a canned JSON message.
function fakeClient(payload: unknown) {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      },
    },
  } as never;
}

const profile: RiskProfile = {
  id: "p",
  segment: "business",
  kind: "event_trigger",
  underlying: { type: "sports", ref: "Indianapolis vs Houston" },
  condition: "Indianapolis wins",
  exposureUsd: { low: 1, expected: 2, high: 3 },
  window: { start: "", end: "" },
  source: "conversation",
};

const candidate = { symbol: "GEMI-REAL", marketTitle: "Indianapolis vs Houston", label: "Indianapolis", expiry: "", rulesText: "" } as Contract;

describe("OpenAICompatibleProvider", () => {
  it("drops hallucinated symbols and 'none' matches", async () => {
    const ai = new OpenAICompatibleProvider(
      fakeClient({
        matches: [
          { symbol: "GEMI-REAL", outcome: "yes", quality: "exact", rationale: "same game", ruleMismatches: [] },
          { symbol: "GEMI-FAKE", outcome: "yes", quality: "exact", rationale: "invented", ruleMismatches: [] },
          { symbol: "GEMI-REAL", outcome: "no", quality: "none", rationale: "irrelevant", ruleMismatches: [] },
        ],
      }),
      "test-model",
    );
    const matches = await ai.rankMarkets(profile, [candidate]);
    expect(matches).toHaveLength(1);
    expect(matches[0].symbol).toBe("GEMI-REAL");
  });

  it("orders exposure estimates and builds a business RiskProfile", async () => {
    const ai = new OpenAICompatibleProvider(
      fakeClient({
        kind: "event_trigger",
        underlyingType: "sports",
        underlyingRef: "Indianapolis vs Houston",
        condition: "Indianapolis wins",
        exposureLow: 3600,
        exposureExpected: 3000,
        exposureHigh: 2400,
        priceUnits: 0,
        windowStart: "2026-11-22T00:00:00Z",
        windowEnd: "2026-11-23T00:00:00Z",
        notes: "",
        followUps: [],
      }),
      "test-model",
    );
    const { profile: p } = await ai.parseRisk("Half-price wings if the Colts win", new Date());
    expect(p.exposureUsd).toEqual({ low: 2400, expected: 3000, high: 3600 });
    expect(p.segment).toBe("business");
  });

  it("rejects malformed model output", async () => {
    const ai = new OpenAICompatibleProvider(fakeClient({ kind: "nonsense" }), "test-model");
    await expect(ai.parseRisk("x", new Date())).rejects.toThrow();
  });
});
