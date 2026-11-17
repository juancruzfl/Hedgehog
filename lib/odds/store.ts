import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
