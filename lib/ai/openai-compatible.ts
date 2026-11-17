import OpenAI from "openai";
import { z } from "zod";
import type { Contract, RiskProfile } from "@/lib/types";
import type { AIProvider, MarketMatch, ParsedRisk, SearchPlan } from "./types";

// One implementation for any OpenAI-compatible API: xAI Grok (default), OpenAI,
// Google's OpenAI-compatible endpoint, etc. Configure with:
//   AI_BASE_URL (default https://api.x.ai/v1), AI_API_KEY (or XAI_API_KEY), AI_MODEL

export const CATEGORIES = ["Sports", "Crypto", "Weather", "Commodities"] as const;

type Chat = Pick<OpenAI, "chat">;

// ---------- schemas (JSON schema for the model, zod for validating what comes back) ----------

const riskJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "underlyingType", "underlyingRef", "condition", "exposureLow", "exposureExpected", "exposureHigh", "windowStart", "windowEnd", "notes", "followUps"],
  properties: {
    kind: { type: "string", enum: ["price_drop", "price_rise", "event_trigger", "threshold"] },
    underlyingType: { type: "string", enum: ["crypto", "sports", "weather", "commodity"] },
    underlyingRef: { type: "string", description: "Team matchup, city, asset or commodity, e.g. 'Indianapolis vs Houston', 'Austin', 'WTI'" },
    condition: { type: "string", description: "The trigger that costs the user money, e.g. 'Indianapolis wins', 'Austin high above 90F'" },
    exposureLow: { type: "number", description: "USD cost to the user if triggered, low estimate" },
    exposureExpected: { type: "number" },
    exposureHigh: { type: "number" },
    windowStart: { type: "string", description: "ISO 8601" },
    windowEnd: { type: "string", description: "ISO 8601" },
    notes: { type: "string", description: "Assumptions you made" },
    followUps: { type: "array", items: { type: "string" }, description: "Questions if key facts are missing; empty if none" },
  },
} as const;

const RiskOut = z.object({
  kind: z.enum(["price_drop", "price_rise", "event_trigger", "threshold"]),
  underlyingType: z.enum(["crypto", "sports", "weather", "commodity"]),
  underlyingRef: z.string(),
  condition: z.string(),
  exposureLow: z.number().nonnegative(),
  exposureExpected: z.number().nonnegative(),
  exposureHigh: z.number().nonnegative(),
  windowStart: z.string(),
  windowEnd: z.string(),
  notes: z.string(),
  followUps: z.array(z.string()),
});

const searchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categories", "terms"],
  properties: {
    categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
    terms: { type: "array", items: { type: "string" }, description: "Short title search terms: team/city names, asset tickers" },
  },
} as const;

const SearchOut = z.object({ categories: z.array(z.enum(CATEGORIES)), terms: z.array(z.string()) });

const matchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "outcome", "quality", "rationale", "ruleMismatches"],
        properties: {
          symbol: { type: "string" },
          outcome: { type: "string", enum: ["yes", "no"] },
          quality: { type: "string", enum: ["exact", "proxy", "none"] },
          rationale: { type: "string" },
          ruleMismatches: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const MatchOut = z.object({
  matches: z.array(
    z.object({
      symbol: z.string(),
      outcome: z.enum(["yes", "no"]),
      quality: z.enum(["exact", "proxy", "none"]),
      rationale: z.string(),
      ruleMismatches: z.array(z.string()),
    }),
  ),
});

// ---------- provider ----------

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;

  constructor(
    private client: Chat,
    private model: string,
    name = "openai-compatible",
  ) {
    this.name = name;
  }

  static fromEnv(): OpenAICompatibleProvider {
    const apiKey = process.env.AI_API_KEY ?? process.env.XAI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiKey) throw new Error("AI_API_KEY (or XAI_API_KEY) is not set");
    if (!model) throw new Error("AI_MODEL is not set (e.g. a Grok model id from https://docs.x.ai)");
    const baseURL = process.env.AI_BASE_URL ?? "https://api.x.ai/v1";
    return new OpenAICompatibleProvider(new OpenAI({ apiKey, baseURL }), model, baseURL.includes("x.ai") ? "grok" : "openai-compatible");
  }

  private async json<T>(system: string, user: string, schemaName: string, schema: object, parser: z.ZodType<T>): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema: schema as Record<string, unknown> } },
    });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new Error(`AI returned no content for ${schemaName}`);
    return parser.parse(JSON.parse(text));
  }

  async parseRisk(text: string, now: Date): Promise<ParsedRisk> {
    const out = await this.json(
      [
        "You turn a small business owner's description of a promotion or cost risk into structured data.",
        "exposure* = the USD the business loses IF the trigger happens (e.g. promo discount x expected redemptions).",
        "Give low/expected/high estimates around the owner's numbers (e.g. +/-20% turnout) unless they gave a range.",
        "Resolve relative dates ('Sunday', 'this weekend') against the current time. Use US team/city names as written.",
        "If the trigger, the date, or the cost cannot be determined, list short follow-up questions. Never invent prices.",
      ].join(" "),
      `Current time: ${now.toISOString()}\n\nDescription:\n${text}`,
      "risk_profile",
      riskJsonSchema,
      RiskOut,
    );
    const [low, expected, high] = [out.exposureLow, out.exposureExpected, out.exposureHigh].sort((a, b) => a - b);
    return {
      profile: {
        id: `biz-${now.getTime()}`,
        segment: "business",
        kind: out.kind,
        underlying: { type: out.underlyingType, ref: out.underlyingRef },
        condition: out.condition,
        exposureUsd: { low, expected, high },
        window: { start: out.windowStart, end: out.windowEnd },
        source: "conversation",
        notes: out.notes,
      },
      followUps: out.followUps,
    };
  }

  async searchPlan(profile: RiskProfile): Promise<SearchPlan> {
    return this.json(
      [
        `Prediction market titles look like "Indianapolis vs Houston", "Highest temperature in Austin on November 17, 2026?", "BTC price on November 20", "Oil (WTI) price on November 20?".`,
        `Choose categories from ${CATEGORIES.join(", ")} and 1-4 short search terms that would appear in matching titles (single team or city names work best).`,
      ].join(" "),
      JSON.stringify({ underlying: profile.underlying, condition: profile.condition, window: profile.window }),
      "search_plan",
      searchJsonSchema,
      SearchOut,
    );
  }

  async rankMarkets(profile: RiskProfile, candidates: Contract[]): Promise<MarketMatch[]> {
    if (candidates.length === 0) return [];
    const compact = candidates.slice(0, 60).map((c) => ({
      symbol: c.symbol,
      market: c.marketTitle,
      contract: c.label,
      expiry: c.expiry,
      rules: c.rulesText.slice(0, 500),
    }));
    const out = await this.json(
      [
        "You match a user's risk to prediction market contracts. Each contract pays $1 if its outcome resolves true.",
        "For each relevant contract return the outcome (yes/no) that PAYS OUT WHEN THE USER'S RISK HAPPENS.",
        "quality: exact = the contract resolves on the same event/condition as the risk; proxy = correlated but not identical; none = irrelevant (omit these).",
        "Read the rules carefully and list concrete mismatches with the user's condition (overtime, margins, thresholds, timing, data source, cancellation).",
        "Only use symbols from the candidate list. Return at most 5, best first.",
      ].join(" "),
      JSON.stringify({ risk: { condition: profile.condition, underlying: profile.underlying, window: profile.window }, candidates: compact }),
      "market_matches",
      matchJsonSchema,
      MatchOut,
    );
    const allowed = new Set(compact.map((c) => c.symbol));
    return out.matches.filter((m) => allowed.has(m.symbol) && m.quality !== "none");
  }
}
