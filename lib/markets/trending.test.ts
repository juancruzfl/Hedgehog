import { describe, expect, it } from "vitest";
import game from "../../fixtures/gemini/game-event.json";
import btc from "../../fixtures/gemini/btc-event.json";
import { pickTrending, toCard, type TrendingEvent } from "./trending";

const NOW = Date.parse("2026-11-17T12:00:00Z"); // before both fixtures close
const G = game as unknown as TrendingEvent;
const B = btc as unknown as TrendingEvent;
const ev = (base: TrendingEvent, ticker: string, volume24h: string, extra: Partial<TrendingEvent> = {}): TrendingEvent => ({ ...base, ticker, id: ticker, volume24h, ...extra });

describe("pickTrending", () => {
  it("ranks by 24-hour volume, counting a game's sub-markets toward it and showing the game itself", () => {
    const picks = pickTrending(
      [
        ev(G, "NCAAM-1-A-B-T", "900", { title: "A vs B: Total Points" }),
        ev(G, "NCAAM-1-A-B-M", "100", { title: "A vs B" }),
        ev(G, "NCAAM-2-C-D-M", "700", { title: "C vs D" }),
        ev(B, "BTC1", "300"),
      ],
      NOW,
    );
    expect(picks.map((p) => p.ticker)).toEqual(["NCAAM-1-A-B-M", "NCAAM-2-C-D-M", "BTC1"]);
  });

  it("caps each category and the total", () => {
    const many = Array.from({ length: 8 }, (_, k) => ev(G, `NCAAM-${k}-X-Y-M`, String(1000 - k), { title: `X${k} vs Y` }));
    const picks = pickTrending([...many, ev(B, "BTC1", "1")], NOW, { limit: 4, perCategory: 3 });
    expect(picks.map((p) => p.category)).toEqual(["Sports", "Sports", "Sports", "Crypto"]);
  });

  it("skips markets that close within the hour or have no prices", () => {
    const soon = ev(B, "BTC-SOON", "999", { expiryDate: new Date(NOW + 20 * 60_000).toISOString() });
    const unpriced = ev(B, "BTC-NONE", "999", { contracts: [] });
    expect(pickTrending([soon, unpriced, ev(B, "BTC1", "1")], NOW).map((p) => p.ticker)).toEqual(["BTC1"]);
  });
});

describe("toCard", () => {
  it("shows a game as who wins, leader first, closing at kickoff", () => {
    const c = toCard(G);
    expect(c.question).toBe("Who wins, Mississippi State vs UCF?");
    expect(c.category).toBe("Sports");
    expect(c.badge).toBe("NCAA");
    expect(c.closes).toBe("2026-11-18T00:00:00.000Z");
    expect(c.lines).toHaveLength(2);
    expect(c.lines[0].featured).toBe(true);
    expect(c.prob).toBe(c.lines[0].prob);
    expect(c.lead).toBe(`${c.lines[0].label} wins`);
  });

  it("shows a price ladder at the level nearest even odds, with its neighbors", () => {
    const c = toCard(B);
    expect(c.badge).toBe("BTC");
    expect(c.lines.length).toBe(3);
    const f = c.lines.find((l) => l.featured)!;
    expect(c.lines[1]).toBe(f); // the featured level sits in the middle
    for (const l of c.lines) expect(Math.abs(f.prob - 0.5)).toBeLessThanOrEqual(Math.abs(l.prob - 0.5));
  });
});
