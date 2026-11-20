import { oddsDb, type OddsRow } from "@/lib/odds/store";
import type { ArchiveReading } from "./merkle";

// Tracked games (with their start time and markets) and each game's kickoff seal: a
// fingerprint of its markets' last readings before play began, recorded on Solana.

function db() {
  const d = oddsDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS games (
      ticker TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      market_ids TEXT NOT NULL, -- JSON array: the game and its child markets
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kickoff_seals (
      ticker TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      reading_ts INTEGER NOT NULL,
      count INTEGER NOT NULL,
      root TEXT NOT NULL,
      cluster TEXT NOT NULL,
      signature TEXT,
      sealed_at INTEGER,
      error TEXT
    );
  `);
  return d;
}

export interface TrackedGame {
  ticker: string;
  title: string;
  startTime: number;
  marketIds: string[];
}

export function upsertGames(games: TrackedGame[]): void {
  const stmt = db().prepare(
    `INSERT INTO games VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET title = excluded.title, start_time = excluded.start_time, market_ids = excluded.market_ids, updated_at = excluded.updated_at`,
  );
  for (const g of games) stmt.run(g.ticker, g.title, g.startTime, JSON.stringify(g.marketIds), Date.now());
}

/** Games that have kicked off (within `withinMs`) and don't have a kickoff seal on-chain yet. */
export function gamesAwaitingKickoffSeal(now: number, withinMs = 24 * 3600_000): TrackedGame[] {
  const rows = db()
    .prepare(
      `SELECT g.ticker, g.title, g.start_time AS startTime, g.market_ids AS marketIds FROM games g
       LEFT JOIN kickoff_seals k ON k.ticker = g.ticker
       WHERE g.start_time <= ? AND g.start_time > ? AND k.signature IS NULL
       ORDER BY g.start_time`,
    )
    .all(now, now - withinMs) as { ticker: string; title: string; startTime: number; marketIds: string }[];
  return rows.map((r) => ({ ...r, marketIds: JSON.parse(r.marketIds) as string[] }));
}

/** The game's last snapshot before `before`: every contract reading at that moment, in archive order. */
export function lastReadingsBefore(marketIds: string[], before: number): { ts: number; rows: ArchiveReading[] } | null {
  if (!marketIds.length) return null;
  const qs = marketIds.map(() => "?").join(",");
  const d = db();
  const last = d.prepare(`SELECT MAX(ts) AS ts FROM odds WHERE market_id IN (${qs}) AND ts < ?`).get(...marketIds, before) as { ts: number | null };
  if (last.ts === null) return null;
  const rows = d
    .prepare(
      `SELECT ts, symbol, market_id AS marketId, yes_bid AS yesBid, yes_ask AS yesAsk, last
       FROM odds WHERE ts = ? AND market_id IN (${qs}) ORDER BY ts, symbol`,
    )
    .all(last.ts, ...marketIds) as unknown as ArchiveReading[];
  return { ts: last.ts, rows };
}

export interface KickoffSeal {
  ticker: string;
  title: string;
  startTime: number;
  readingTs: number;
  count: number;
  root: string;
  cluster: string;
  signature: string | null;
  sealedAt: number | null;
  error: string | null;
}

const cols = `ticker, title, start_time AS startTime, reading_ts AS readingTs, count, root, cluster, signature, sealed_at AS sealedAt, error`;

export function saveKickoffSeal(k: KickoffSeal): void {
  db()
    .prepare(
      `INSERT INTO kickoff_seals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ticker) DO UPDATE SET reading_ts = excluded.reading_ts, count = excluded.count, root = excluded.root,
         cluster = excluded.cluster, signature = excluded.signature, sealed_at = excluded.sealed_at, error = excluded.error`,
    )
    .run(k.ticker, k.title, k.startTime, k.readingTs, k.count, k.root, k.cluster, k.signature, k.sealedAt, k.error);
}

export function listKickoffSeals(limit = 20): KickoffSeal[] {
  return db().prepare(`SELECT ${cols} FROM kickoff_seals WHERE signature IS NOT NULL ORDER BY start_time DESC LIMIT ?`).all(limit) as unknown as KickoffSeal[];
}

/** Kickoff seals for the games that any of these markets belong to (a game or one of its child markets). */
export function getKickoffForMarkets(marketIds: string[]): KickoffSeal[] {
  if (!marketIds.length) return [];
  const games = db().prepare(`SELECT ticker, market_ids AS marketIds FROM games`).all() as { ticker: string; marketIds: string }[];
  const tickers = games.filter((g) => (JSON.parse(g.marketIds) as string[]).some((m) => marketIds.includes(m))).map((g) => g.ticker);
  if (!tickers.length) return [];
  return db()
    .prepare(`SELECT ${cols} FROM kickoff_seals WHERE signature IS NOT NULL AND ticker IN (${tickers.map(() => "?").join(",")})`)
    .all(...tickers) as unknown as KickoffSeal[];
}

export type { OddsRow };
