import { describe, expect, it } from "vitest";
import type { Contract, RiskProfile } from "@/lib/types";
import { OpenAICompatibleProvider, resolveAIConfig, stripFences } from "./openai-compatible";

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

describe("models without strict JSON schema support (e.g. some OpenRouter models)", () => {
  const plan = { categories: ["Sports"], terms: ["Indianapolis"] };
  const p = { condition: "x", underlying: { type: "sports", ref: "x" }, window: { start: "", end: "" } } as RiskProfile;

  it("falls back to JSON mode when json_schema is rejected, then stays in JSON mode", async () => {
    const formats: string[] = [];
    const client = {
      chat: {
        completions: {
          create: async (req: { response_format: { type: string } }) => {
            formats.push(req.response_format.type);
            if (req.response_format.type === "json_schema") {
              throw Object.assign(new Error("400 response_format json_schema is not supported by this model"), { status: 400 });
            }
            return { choices: [{ message: { content: JSON.stringify(plan) } }] };
          },
        },
      },
    } as never;
    const ai = new OpenAICompatibleProvider(client, "some/model");
    expect(await ai.searchPlan(p)).toEqual(plan);
    expect(await ai.searchPlan(p)).toEqual(plan);
    expect(formats).toEqual(["json_schema", "json_object", "json_object"]);
  });

  it("does not hide real errors behind the fallback", async () => {
    const client = {
      chat: { completions: { create: async () => { throw Object.assign(new Error("402 insufficient credits"), { status: 402 }); } } },
    } as never;
    await expect(new OpenAICompatibleProvider(client, "m").searchPlan(p)).rejects.toThrow(/402/);
  });

  it("strips code fences around JSON", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("resolveAIConfig: each key only goes to its own provider", () => {
  const base = { AI_MODEL: "m" } as unknown as NodeJS.ProcessEnv;
  it("sends an OpenRouter key to OpenRouter by default", () => {
    expect(resolveAIConfig({ ...base, AI_API_KEY: "sk-or-abc" }).baseURL).toBe("https://openrouter.ai/api/v1");
    expect(resolveAIConfig({ ...base, OPENROUTER_API_KEY: "sk-or-abc" }).baseURL).toBe("https://openrouter.ai/api/v1");
  });
  it("never sends an xAI key to OpenRouter", () => {
    expect(resolveAIConfig({ ...base, XAI_API_KEY: "xai-abc" }).baseURL).toBe("https://api.x.ai/v1");
    expect(resolveAIConfig({ ...base, AI_API_KEY: "xai-abc" }).baseURL).toBe("https://api.x.ai/v1");
  });
  it("prefers an OpenRouter key over a leftover xAI key", () => {
    expect(resolveAIConfig({ ...base, OPENROUTER_API_KEY: "sk-or-abc", XAI_API_KEY: "xai-abc" })).toMatchObject({ apiKey: "sk-or-abc", openrouter: true });
  });
  it("respects an explicit AI_BASE_URL", () => {
    expect(resolveAIConfig({ ...base, AI_API_KEY: "k", AI_BASE_URL: "https://example.test/v1" }).baseURL).toBe("https://example.test/v1");
  });
});
