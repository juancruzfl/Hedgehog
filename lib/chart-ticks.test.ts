import { describe, expect, it } from "vitest";
import { timeTicks } from "./chart-ticks";

const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m).getTime(); // local time, Nov 17

describe("odds chart time ticks", () => {
  it("lands on round, evenly spaced local hours", () => {
    const { ticks, stepH } = timeTicks(at(19, 3), at(26, 57)); // 7:03 PM to 2:57 AM next day
    expect(stepH).toBe(2);
    expect(ticks.map((t) => new Date(t).getHours())).toEqual([20, 22, 0, 2]);
    expect(new Set(ticks.slice(1).map((t, i) => t - ticks[i])).size).toBe(1); // even spacing
  });

  it("never puts more than 6 ticks on the axis", () => {
    for (const hours of [1, 5, 13, 30, 80, 200]) {
      expect(timeTicks(at(9, 17), at(9, 17) + hours * 3600_000).ticks.length).toBeLessThanOrEqual(6);
    }
  });

  it("uses midnights for multi-day spans", () => {
    const { ticks, stepH } = timeTicks(at(9), at(9) + 5 * 24 * 3600_000);
    expect(stepH).toBeGreaterThanOrEqual(24);
    for (const t of ticks) expect(new Date(t).getHours()).toBe(0);
  });
});
