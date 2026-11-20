import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Contract } from "@/lib/types";

// Odds history store. Gemini's API doesn't return price history for these markets,
// so Hedgehog records its own snapshots (scripts/collect-odds.ts) for odds-over-time charts.

export interface OddsRow {
  ts: number; // unix ms
  symbol: string;
  marketId: string;
  marketTitle: string;
  category: string;
  label: string;
  strikeType: string | null;
  strikeValue: number | null;
  expiry: string;
  yesBid: number | null;
  yesAsk: number | null;
  last: number | null;
}

/** A reading row for one contract's quote at `ts`. */
export const rowFromContract = (ts: number, c: Contract): OddsRow => ({
  ts,
  symbol: c.symbol,
  marketId: c.marketId,
  marketTitle: c.marketTitle,
  category: c.category,
  label: c.label,
  strikeType: c.strike?.type ?? null,
  strikeValue: c.strike?.value ?? null,
  expiry: c.expiry,
  yesBid: c.quote.yesBid,
  yesAsk: c.quote.yesAsk,
  last: c.quote.last,
});

const DB_PATH = process.env.ODDS_DB_PATH ?? path.join(process.cwd(), "data", "odds.sqlite");

let db: DatabaseSync | null = null;

export function oddsDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS odds (
      ts INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      market_id TEXT NOT NULL,
      market_title TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      strike_type TEXT,
      strike_value REAL,
      expiry TEXT NOT NULL,
      yes_bid REAL,
      yes_ask REAL,
      last REAL,
      PRIMARY KEY (symbol, ts)
    );
    CREATE INDEX IF NOT EXISTS odds_market_ts ON odds (market_id, ts);
    -- Markets outside the collected categories (e.g. a game) that someone looked at.
    CREATE TABLE IF NOT EXISTS watch (
      market_id TEXT PRIMARY KEY,
      added_ts INTEGER NOT NULL
    );
  `);
  return db;
}

export function insertSnapshot(rows: OddsRow[]): void {
  const d = oddsDb();
  const stmt = d.prepare(
    `INSERT OR IGNORE INTO odds VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  d.exec("BEGIN");
  try {
    for (const r of rows) {
      stmt.run(
        r.ts, r.symbol, r.marketId, r.marketTitle, r.category, r.label,
        r.strikeType, r.strikeValue, r.expiry, r.yesBid, r.yesAsk, r.last,
      );
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export interface OddsPoint {
  ts: number;
  yesBid: number | null;
  yesAsk: number | null;
  last: number | null;
}

export function historyForSymbol(symbol: string, sinceMs = 0): OddsPoint[] {
  return oddsDb()
    .prepare(
      `SELECT ts, yes_bid AS yesBid, yes_ask AS yesAsk, last FROM odds
       WHERE symbol = ? AND ts >= ? ORDER BY ts`,
    )
    .all(symbol, sinceMs) as unknown as OddsPoint[];
}

/** Start recording a market's odds on every snapshot (until it expires). */
export function watchMarkets(ids: string[]): void {
  const stmt = oddsDb().prepare(`INSERT OR IGNORE INTO watch (market_id, added_ts) VALUES (?, ?)`);
  for (const id of ids) stmt.run(id, Date.now());
}

export function watchedMarketIds(): string[] {
  return (oddsDb().prepare(`SELECT market_id AS id FROM watch`).all() as { id: string }[]).map((r) => r.id);
}

export function unwatchMarket(id: string): void {
  oddsDb().prepare(`DELETE FROM watch WHERE market_id = ?`).run(id);
}
