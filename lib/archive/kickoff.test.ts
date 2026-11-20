import { describe, expect, it } from "vitest";
import { insertSnapshot, type OddsRow } from "@/lib/odds/store";
import { gamesAwaitingKickoffSeal, lastReadingsBefore, saveKickoffSeal, upsertGames } from "./kickoff-store";
import { hedgeMemoFor, kickoffMemoFor, parseHedgeMemo, parseKickoffMemo } from "./merkle";

const row = (ts: number, symbol: string, marketId: string, yesAsk: number): OddsRow => ({
  ts, symbol, marketId, marketTitle: "Game", category: "Sports", label: "x", strikeType: null, strikeValue: null,
  expiry: "2026-11-21T00:00:00Z", yesBid: yesAsk - 0.02, yesAsk, last: null,
});

describe("kickoff seals", () => {
  const start = Date.parse("2026-11-20T18:00:00Z");
  const min = 60_000;

  it("finds the game's last snapshot before kickoff, across its child markets", () => {
    insertSnapshot([row(start - 10 * min, "WIN-NYK", "G1", 0.5), row(start - 10 * min, "TOT-220", "G1-T", 0.4)]);
    insertSnapshot([row(start - 5 * min, "WIN-NYK", "G1", 0.55), row(start - 5 * min, "TOT-220", "G1-T", 0.42), row(start - 5 * min, "OTHER", "G2", 0.1)]);
    insertSnapshot([row(start + 5 * min, "WIN-NYK", "G1", 0.7)]); // in play: must not count
    const last = lastReadingsBefore(["G1", "G1-T"], start)!;
    expect(last.ts).toBe(start - 5 * min);
    expect(last.rows.map((r) => r.symbol).sort()).toEqual(["TOT-220", "WIN-NYK"]);
  });

  it("lists started games until they're sealed", () => {
    upsertGames([
      { ticker: "G1", title: "Portland vs New York", startTime: start, marketIds: ["G1", "G1-T"] },
      { ticker: "G9", title: "Later game", startTime: start + 3600_000, marketIds: ["G9"] },
    ]);
    expect(gamesAwaitingKickoffSeal(start + min).map((g) => g.ticker)).toEqual(["G1"]);
    saveKickoffSeal({ ticker: "G1", title: "x", startTime: start, readingTs: start - 5 * min, count: 2, root: "a".repeat(64), cluster: "devnet", signature: "sig", sealedAt: 1, error: null });
    expect(gamesAwaitingKickoffSeal(start + min)).toEqual([]);
  });
});

describe("memos", () => {
  it("round-trip hedge and kickoff memos", () => {
    const sha = "b".repeat(64);
    expect(parseHedgeMemo(hedgeMemoFor("abc-123", sha))).toEqual({ hedgeId: "abc-123", sha256: sha });
    const k = parseKickoffMemo(kickoffMemoFor("NFL-X", Date.parse("2026-11-20T18:00:00Z"), Date.parse("2026-11-20T17:55:00Z"), 12, sha));
    expect(k).toEqual({ ticker: "NFL-X", startTime: Date.parse("2026-11-20T18:00:00Z"), readingTs: Date.parse("2026-11-20T17:55:00Z"), count: 12, root: sha });
  });
});
