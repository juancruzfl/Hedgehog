import { describe, expect, it } from "vitest";
import { buildLevels, memoFor, parseMemo, proofFor, rootFromProof, rootOf, sortReadings, type ArchiveReading } from "./merkle";

const reading = (i: number, over: Partial<ArchiveReading> = {}): ArchiveReading => ({
  ts: 1_794_960_000_000 + Math.floor(i / 3) * 300_000,
  symbol: `GEMI-SOL2611202200-HI${60 + (i % 3)}`,
  marketId: "SOL2611202200",
  yesBid: 0.1 + i / 1000,
  yesAsk: 0.12 + i / 1000,
  last: i % 4 === 0 ? null : 0.11,
  ...over,
});

describe("odds archive fingerprints", () => {
  for (const n of [1, 2, 3, 7, 64, 101]) {
    it(`proves every reading back to the root (${n} readings)`, async () => {
      const rows = Array.from({ length: n }, (_, i) => reading(i));
      const levels = await buildLevels(rows);
      const root = rootOf(levels);
      const sorted = sortReadings(rows);
      for (let i = 0; i < n; i++) expect(await rootFromProof(sorted[i], proofFor(levels, i))).toBe(root);
    });
  }

  it("doesn't depend on the order readings arrive in", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => reading(i));
    const shuffled = [...rows].reverse();
    expect(rootOf(await buildLevels(shuffled))).toBe(rootOf(await buildLevels(rows)));
  });

  it("catches an edited price", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => reading(i));
    const levels = await buildLevels(rows);
    const sorted = sortReadings(rows);
    const tampered = { ...sorted[4], yesAsk: sorted[4].yesAsk! + 0.01 };
    expect(await rootFromProof(tampered, proofFor(levels, 4))).not.toBe(rootOf(levels));
  });

  it("changes the root when any reading is added or removed", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => reading(i));
    const root = rootOf(await buildLevels(rows));
    expect(rootOf(await buildLevels(rows.slice(1)))).not.toBe(root);
    expect(rootOf(await buildLevels([...rows, reading(99)]))).not.toBe(root);
  });

  it("round-trips the on-chain memo", () => {
    const root = "a".repeat(64);
    const memo = memoFor(Date.UTC(2026, 10, 18, 9), 8123, root);
    expect(memo).toBe(`hedgehog-odds v1 2026-11-18T09:00:00.000Z n=8123 root=${root}`);
    expect(parseMemo(`Memo (len 120): "${memo}"`)).toEqual({ hourStart: Date.UTC(2026, 10, 18, 9), count: 8123, root });
    expect(parseMemo("something else")).toBeNull();
  });
});
