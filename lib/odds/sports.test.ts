import { describe, expect, it } from "vitest";
import type { GeminiEvent } from "@/lib/venues/gemini/normalize";
import { groupGames, involves, isCoreMarket, pickGames, withParent } from "./sports";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ev = (ticker: string, title: string, startInDays: number, volume24h: string, sides: string[] = []): GeminiEvent => ({
  id: ticker,
  ticker,
  title,
  category: "Sports",
  startTime: new Date(NOW + startInDays * 86_400_000).toISOString(),
  volume24h,
  volume: "999999", // all-time volume must not drive the ranking
  participants: sides.map((name) => ({ name })),
});

describe("groupGames", () => {
  it("folds a game's sub-markets into it and keeps only full-game markets", () => {
    const [g] = groupGames([
      ev("NFL-1-MIA-BUF-M", "Miami vs Buffalo", 2, "100", ["Miami Dolphins", "Buffalo Bills"]),
      ev("NFL-1-MIA-BUF-T", "Miami vs Buffalo: Point Total", 2, "50"),
      ev("NFL-1-MIA-BUF-S", "Miami vs Buffalo: Point Spread", 2, "25"),
      ev("NFL-1-MIA-BUF-1QT", "Miami vs Buffalo: 1st Quarter Point Total", 2, "5"),
      ev("NFL-1-MIA-BUF-PTD", "Miami vs Buffalo: Player Touchdowns", 2, "5"),
    ]);
    expect(g).toMatchObject({ key: "NFL-1-MIA-BUF", title: "Miami vs Buffalo", volume24h: 185 });
    expect(g.marketIds.sort()).toEqual(["NFL-1-MIA-BUF-M", "NFL-1-MIA-BUF-S", "NFL-1-MIA-BUF-T"]);
  });

  it("recognizes full-game totals and spreads", () => {
    expect(isCoreMarket(ev("a", "A vs B: Total Goals", 1, "0"))).toBe(true);
    expect(isCoreMarket(ev("a", "A vs B: 2nd Half Point Total", 1, "0"))).toBe(false);
    expect(isCoreMarket(ev("a", "A vs B: Quarterback Passing Yards", 1, "0"))).toBe(false);
  });
});

describe("withParent", () => {
  it("adds a game Gemini only listed through its sub-markets, with its nested total and spread", () => {
    const [g] = groupGames([ev("NFL-1-MIA-BUF-1QT", "Miami vs Buffalo: 1st Quarter Point Total", 2, "5")]);
    expect(g).toMatchObject({ hasParent: false, markets: [] });
    const parent = { ...ev("NFL-1-MIA-BUF-M", "Miami vs Buffalo", 2, "0"), events: [ev("NFL-1-MIA-BUF-T", "Miami vs Buffalo: Point Total", 2, "0")] };
    expect(withParent(g, parent)).toMatchObject({ hasParent: true, title: "Miami vs Buffalo", marketIds: ["NFL-1-MIA-BUF-M", "NFL-1-MIA-BUF-T"] });
  });
});

describe("pickGames", () => {
  const events = [
    ev("G1-M", "A vs B", 1, "500"),
    ev("G2-M", "C vs D", 2, "900"),
    ev("G3-M", "E vs F", 3, "100"),
    ev("G3-T", "E vs F: Total Points", 3, "450"), // a game's volume counts all its markets
    ev("G4-M", "Portland vs New York", 2, "1", ["Portland Trail Blazers", "New York Knicks"]),
    ev("G5-M", "G vs H", 9, "5000"), // too far out
    ev("G6-M", "I vs J", -0.05, "50"), // under way: still tracked
  ];

  it("ranks games by 24-hour volume within the next 7 days", () => {
    expect(pickGames(events, NOW, { top: 2, teams: [] }).map((g) => g.key)).toEqual(["G2", "G3"]);
  });

  it("always adds our customers' teams, matched on the sides' full names", () => {
    expect(pickGames(events, NOW, { top: 2, teams: ["Knicks"] }).map((g) => g.key)).toEqual(["G2", "G3", "G4"]);
  });

  it("never lists a game twice and skips games past the window", () => {
    const keys = pickGames(events, NOW, { top: 25, teams: ["Knicks"] }).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("G5");
    expect(keys).toContain("G6");
  });
});

describe("involves", () => {
  it("matches whole words only", () => {
    expect(involves(ev("x", "Jets vs Bills", 1, "0"), ["Jets"])).toBe(true);
    expect(involves(ev("y", "Jetsons Classic", 1, "0"), ["Jets"])).toBe(false);
  });
});
