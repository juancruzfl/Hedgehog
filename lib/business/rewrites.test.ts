import { describe, expect, it } from "vitest";
import { suggestRewrites } from "./rewrites";

const profile = { exposureUsd: { low: 4000, expected: 5000, high: 6000 }, window: { start: "2026-11-21T00:00:00Z", end: "2026-11-21T23:59:00Z" } };

describe("suggestRewrites", () => {
  it("leads with the closest market type and keeps the user's cost and date", () => {
    const r = suggestRewrites("If it rains during my outdoor event I refund deposits", profile);
    expect(r[0].id).toBe("weather");
    expect(r[0].text).toContain("$5,000");
    expect(r[0].text).toContain("Saturday, Nov 21");
    expect(r).toHaveLength(3);
  });

  it("ranks fuel first for a delivery business", () => {
    expect(suggestRewrites("Our delivery vans burn a lot of diesel", profile)[0].id).toBe("fuel");
  });

  it("falls back to placeholders when cost or date is missing", () => {
    const r = suggestRewrites("something unusual", { exposureUsd: { low: 0, expected: 0, high: 0 }, window: { start: "", end: "" } });
    expect(r[0].text).toContain("[$ amount]");
    expect(r[0].text).toContain("[the date]");
  });

  it("never repeats a suggestion", () => {
    const ids = suggestRewrites("rain snow game diesel gold", profile, 4).map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
