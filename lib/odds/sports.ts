import type { GeminiEvent } from "@/lib/venues/gemini/normalize";

// Which sports games to record before anyone opens them. Gemini only has odds history if
// Hedgehog recorded it, so games a business might hedge need tracking ahead of time:
//   - the busiest upcoming games by 24-hour volume (where a hedge can actually be bought
//     near the quoted price; total volume would favor markets that have simply been open
//     longest), and
//   - always, the teams Hedgehog's customers run promos on, whatever their volume.
//
// Gemini lists each game's sub-markets ("Miami vs Buffalo: Point Total", player props, …)
// as events of their own, sharing the game's ticker prefix (NFL-2611221800-MIA-BUF-M, -T,
// -S, …). They're grouped back into one game here. Only a game's core markets are recorded
// (who wins, the full-game total and spread): a promo like "a free shot per touchdown" is
// hedged with a points total, and skipping player props keeps the archive small.

export const DEFAULT_TEAMS = ["Knicks", "Browns", "Seahawks", "Dolphins", "Giants", "Jets", "Rangers"];
export const alwaysTeams = (): string[] => {
  const env = process.env.SPORTS_ALWAYS_TEAMS?.split(",").map((s) => s.trim()).filter(Boolean);
  return env?.length ? env : DEFAULT_TEAMS;
};

const DAY = 86_400_000;

/** The game an event belongs to: its ticker without the market suffix. */
export const gameKey = (e: GeminiEvent) => e.ticker.replace(/-[^-]+$/, "");

/** Full-game markets: the game itself, "…: Total Points", "…: Point Total", "…: Point Spread". */
export function isCoreMarket(e: GeminiEvent): boolean {
  const i = e.title.indexOf(": ");
  if (i < 0) return true;
  return /^(?:Total [A-Za-z]+|[A-Za-z]+ Total|Point Spread|Spread)$/.test(e.title.slice(i + 2));
}

/** True if one of `teams` plays (matched on whole words in the title or a side's full name). */
export function involves(ev: GeminiEvent, teams: string[]): boolean {
  const names = [ev.title, ...(ev.participants ?? []).map((p) => p.name)].join(" | ");
  return teams.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(names));
}

export interface Game {
  key: string;
  title: string; // "Miami vs Buffalo"
  startTime: number;
  volume24h: number; // across all its markets
  /** The core markets to record, each possibly nesting its own children. */
  markets: GeminiEvent[];
  /** Every market id (ticker) of the game that gets recorded: for its kickoff seal. */
  marketIds: string[];
  /**
   * False when Gemini's list only had the game's sub-markets (it sometimes leaves the game
   * itself out, e.g. NFL); the game is then fetched directly as `<key>-M` (see withParent).
   */
  hasParent: boolean;
}

const coreIds = (markets: GeminiEvent[]) => {
  const ids = new Set<string>();
  for (const m of markets) for (const id of [m.ticker, ...(m.events ?? []).filter(isCoreMarket).map((c) => c.ticker)]) ids.add(id);
  return [...ids];
};

/** Adds the game's own event (fetched directly) and its nested full-game markets. */
export function withParent(g: Game, parent: GeminiEvent | null): Game {
  if (!parent || g.hasParent) return g;
  const markets = [parent, ...g.markets.filter((m) => m.ticker !== parent.ticker)];
  return { ...g, title: parent.title, markets, marketIds: coreIds(markets), hasParent: true };
}

export function groupGames(events: GeminiEvent[]): Game[] {
  const groups = new Map<string, GeminiEvent[]>();
  for (const e of events) {
    if (!Number.isFinite(Date.parse(e.startTime ?? ""))) continue;
    const k = gameKey(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()].map(([key, all]) => {
    const markets = all.filter(isCoreMarket);
    const parent = all.find((e) => !e.title.includes(": "));
    return {
      key,
      title: parent?.title ?? all[0].title.split(": ")[0],
      startTime: Math.min(...all.map((e) => Date.parse(e.startTime!))),
      volume24h: all.reduce((s, e) => s + (Number(e.volume24h ?? 0) || 0), 0),
      markets,
      marketIds: coreIds(markets),
      hasParent: !!parent,
    };
  });
}

/**
 * Games starting within `days` (including ones under way), the `top` busiest by 24-hour
 * volume plus every game involving `teams`. Each game appears once.
 */
export function pickGames(events: GeminiEvent[], now: number, { top = 25, days = 7, teams = alwaysTeams() } = {}): Game[] {
  const soon = now + days * DAY;
  const games = groupGames(events).filter((g) => g.startTime < soon);
  const busiest = [...games].sort((a, b) => b.volume24h - a.volume24h).slice(0, top);
  // A game is ours if any of its markets names one of our teams.
  const oursKeys = new Set(events.filter((e) => involves(e, teams)).map(gameKey));
  const ours = games.filter((g) => oursKeys.has(g.key));
  const out = new Map<string, Game>();
  for (const g of [...busiest, ...ours]) out.set(g.key, g);
  return [...out.values()];
}
