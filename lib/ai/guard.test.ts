import { beforeEach, describe, expect, it } from "vitest";
import { BUSINESS_EXAMPLES } from "@/lib/business/examples";
import { TtlCache, resetLimitsForTests, screenInput, takeDailyAI, takeVisit } from "./guard";

// Real risks must always reach the AI. These cover every category plus risks Gemini has no market for.
const REAL_RISKS = [
  ...BUSINESS_EXAMPLES.map((e) => e.text),
  "Diesel prices rising",
  "Gold prices",
  "If BTC drops below 80k I lose 20k",
  "We hold 3 ETH on the balance sheet and payroll is due Dec 1",
  "Our rent goes up 10% in January",
  "A hurricane could close our shop in Miami",
  "Copper up 15%?",
  "Heat wave in Phoenix kills patio sales",
  "Free pizza if the Knicks score 120+",
  "What happens to my food truck if it rains Saturday?",
  "what is my risk if natural gas spikes",
  "Bills win = free beer, ~300 people",
];

const JUNK = ["what is 1 + 1", "1+1", "What's 2*3?", "12 / 4 = ?", "calculate 99^2", "asdfghjklqwerty", "?????????????", "1234567890"];

describe("screenInput", () => {
  it.each(REAL_RISKS)("lets a real risk through: %s", (text) => {
    expect(screenInput(text)).toBeNull();
  });
  it.each(JUNK)("rejects without an AI call: %s", (text) => {
    expect(screenInput(text)).not.toBeNull();
  });
});

describe("limits", () => {
  beforeEach(() => resetLimitsForTests());

  it("allows 20 requests per visitor per hour, then says how long to wait", () => {
    const t = Date.UTC(2026, 10, 18, 12);
    for (let i = 0; i < 20; i++) expect(takeVisit("1.2.3.4", t + i).ok).toBe(true);
    const blocked = takeVisit("1.2.3.4", t + 30 * 60_000);
    expect(blocked).toEqual({ ok: false, retryMin: 30 });
    expect(takeVisit("5.6.7.8", t).ok).toBe(true); // other visitors unaffected
    expect(takeVisit("1.2.3.4", t + 61 * 60_000).ok).toBe(true); // window slides
  });

  it("stops AI use after the daily budget and resets the next day", () => {
    const t = Date.UTC(2026, 10, 18, 12);
    for (let i = 0; i < 300; i++) expect(takeDailyAI(t)).toBe(true);
    expect(takeDailyAI(t)).toBe(false);
    expect(takeDailyAI(t + 24 * 3600_000)).toBe(true);
  });
});

describe("TtlCache", () => {
  it("reuses answers within the window and retries failures", async () => {
    const c = new TtlCache<number>(1000);
    let n = 0;
    expect(await c.get("k", async () => ++n, 0)).toBe(1);
    expect(await c.get("k", async () => ++n, 500)).toBe(1);
    expect(await c.get("k", async () => ++n, 1500)).toBe(2);
    await expect(c.get("bad", () => Promise.reject(new Error("x")), 0)).rejects.toThrow();
    await Promise.resolve();
    expect(await c.get("bad", async () => 7, 1)).toBe(7);
  });
});
