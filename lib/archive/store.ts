import { oddsDb } from "@/lib/odds/store";
import type { ArchiveReading } from "./merkle";

// One row per archived hour: its fingerprint (Merkle root) and the Solana transaction
// that recorded it. Lives next to the readings in the odds database.

export const HOUR = 3600_000;

export interface ArchiveBatch {
  hourStart: number;
  count: number;
  root: string;
  cluster: string;
  signature: string | null;
  anchoredAt: number | null;
  error: string | null;
}

function db() {
  const d = oddsDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS archive_batches (
      hour_start INTEGER PRIMARY KEY,
      count INTEGER NOT NULL,
      root TEXT NOT NULL,
      cluster TEXT NOT NULL,
      signature TEXT,
      anchored_at INTEGER,
      error TEXT
    );
  `);
  return d;
}

/** Every reading recorded in [hourStart, hourStart + 1h), in fingerprint order. */
export function readingsForHour(hourStart: number): ArchiveReading[] {
  return db()
    .prepare(
      `SELECT ts, symbol, market_id AS marketId, yes_bid AS yesBid, yes_ask AS yesAsk, last
       FROM odds WHERE ts >= ? AND ts < ? ORDER BY ts, symbol`,
    )
    .all(hourStart, hourStart + HOUR) as unknown as ArchiveReading[];
}

export function firstReadingTs(): number | null {
  const r = db().prepare(`SELECT MIN(ts) AS ts FROM odds`).get() as { ts: number | null };
  return r.ts;
}

export function getBatch(hourStart: number): ArchiveBatch | null {
  const r = db()
    .prepare(
      `SELECT hour_start AS hourStart, count, root, cluster, signature, anchored_at AS anchoredAt, error
       FROM archive_batches WHERE hour_start = ?`,
    )
    .get(hourStart) as ArchiveBatch | undefined;
  return r ?? null;
}

export function listBatches(limit = 200): ArchiveBatch[] {
  return db()
    .prepare(
      `SELECT hour_start AS hourStart, count, root, cluster, signature, anchored_at AS anchoredAt, error
       FROM archive_batches ORDER BY hour_start DESC LIMIT ?`,
    )
    .all(limit) as unknown as ArchiveBatch[];
}

export function saveBatch(b: ArchiveBatch): void {
  db()
    .prepare(
      `INSERT INTO archive_batches VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hour_start) DO UPDATE SET count = excluded.count, root = excluded.root, cluster = excluded.cluster,
         signature = excluded.signature, anchored_at = excluded.anchored_at, error = excluded.error`,
    )
    .run(b.hourStart, b.count, b.root, b.cluster, b.signature, b.anchoredAt, b.error);
}

export function archiveTotals(): { readings: number; contracts: number; markets: number; since: number | null } {
  const r = db()
    .prepare(`SELECT COUNT(*) AS readings, COUNT(DISTINCT symbol) AS contracts, COUNT(DISTINCT market_id) AS markets, MIN(ts) AS since FROM odds`)
    .get() as { readings: number; contracts: number; markets: number; since: number | null };
  return r;
}

/** The last snapshot in an hour, a few contracts across categories: the "verify a reading" picker. */
export function sampleReadings(hourStart: number, limit = 8): (ArchiveReading & { label: string; marketTitle: string; category: string })[] {
  const d = db();
  const last = d.prepare(`SELECT MAX(ts) AS ts FROM odds WHERE ts >= ? AND ts < ?`).get(hourStart, hourStart + HOUR) as { ts: number | null };
  if (last.ts === null) return [];
  // Round-robin across categories so the picker isn't all one kind of market.
  const rows = d
    .prepare(
      `SELECT ts, symbol, market_id AS marketId, yes_bid AS yesBid, yes_ask AS yesAsk, last, label,
              market_title AS marketTitle, category
       FROM odds WHERE ts = ? ORDER BY category, market_id, symbol`,
    )
    .all(last.ts) as unknown as (ArchiveReading & { label: string; marketTitle: string; category: string })[];
  const byCat = new Map<string, typeof rows>();
  for (const r of rows) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  const out: typeof rows = [];
  for (let k = 0; out.length < limit && k < rows.length; k++) for (const list of byCat.values()) if (list[k] && out.length < limit) out.push(list[k]);
  return out;
}
