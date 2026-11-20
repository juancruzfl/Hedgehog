import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Local record of hedges the user approved and the orders placed for them.
// Gemini remains the source of truth for fills/positions; this adds the "why".

const DB_PATH = process.env.HEDGES_DB_PATH ?? path.join(process.cwd(), "data", "hedgehog.sqlite");
let db: DatabaseSync | null = null;

function hedgesDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS hedges (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      segment TEXT NOT NULL,
      title TEXT NOT NULL,
      venue TEXT NOT NULL,
      mode TEXT NOT NULL,
      total_cost REAL NOT NULL,
      max_payout REAL NOT NULL,
      profile_json TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hedge_orders (
      hedge_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      outcome TEXT NOT NULL,
      quantity REAL NOT NULL,
      limit_price REAL NOT NULL,
      fill_price REAL,
      order_id TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL
    );
    -- One receipt per hedge: the exact document that was fingerprinted, and where its
    -- fingerprint was recorded on Solana (null until sealed).
    CREATE TABLE IF NOT EXISTS hedge_receipts (
      hedge_id TEXT PRIMARY KEY,
      document TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cluster TEXT,
      signature TEXT,
      sealed_at INTEGER,
      error TEXT
    );
  `);
  return db;
}

export interface HedgeOrder {
  marketId: string;
  symbol: string;
  outcome: string;
  quantity: number;
  limitPrice: number;
  fillPrice: number | null;
  orderId: string | null;
  status: string;
  error: string | null;
}

export interface HedgeRecord {
  id: string;
  createdAt: number;
  segment: string;
  title: string;
  venue: string;
  totalCost: number;
  maxPayout: number;
  status: string;
  mode: string;
  orders: HedgeOrder[];
}

export function createHedge(h: Omit<HedgeRecord, "orders" | "createdAt"> & { profileJson: string }): void {
  hedgesDb()
    .prepare(`INSERT INTO hedges VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(h.id, Date.now(), h.segment, h.title, h.venue, h.mode, h.totalCost, h.maxPayout, h.profileJson, h.status);
}

export function setHedgeStatus(id: string, status: string): void {
  hedgesDb().prepare(`UPDATE hedges SET status = ? WHERE id = ?`).run(status, id);
}

export function addHedgeOrder(hedgeId: string, o: HedgeOrder): void {
  hedgesDb()
    .prepare(`INSERT INTO hedge_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(hedgeId, o.marketId, o.symbol, o.outcome, o.quantity, o.limitPrice, o.fillPrice, o.orderId, o.status, o.error, Date.now());
}

export function listHedges(): HedgeRecord[] {
  const d = hedgesDb();
  const hedges = d.prepare(`SELECT * FROM hedges ORDER BY created_at DESC`).all() as Record<string, unknown>[];
  const orders = d.prepare(`SELECT * FROM hedge_orders WHERE hedge_id = ? ORDER BY created_at`);
  return hedges.map((h) => ({
    id: h.id as string,
    createdAt: h.created_at as number,
    segment: h.segment as string,
    title: h.title as string,
    venue: h.venue as string,
    mode: h.mode as string,
    totalCost: h.total_cost as number,
    maxPayout: h.max_payout as number,
    status: h.status as string,
    orders: (orders.all(h.id as string) as Record<string, unknown>[]).map((o) => ({
      marketId: o.market_id as string,
      symbol: o.symbol as string,
      outcome: o.outcome as string,
      quantity: o.quantity as number,
      limitPrice: o.limit_price as number,
      fillPrice: (o.fill_price as number) ?? null,
      orderId: (o.order_id as string) ?? null,
      status: o.status as string,
      error: (o.error as string) ?? null,
    })),
  }));
}

export interface ReceiptRecord {
  hedgeId: string;
  document: string; // the exact JSON whose SHA-256 is sealed
  sha256: string;
  createdAt: number;
  cluster: string | null;
  signature: string | null;
  sealedAt: number | null;
  error: string | null;
}

const receiptCols = `hedge_id AS hedgeId, document, sha256, created_at AS createdAt, cluster, signature, sealed_at AS sealedAt, error`;

export function saveReceipt(hedgeId: string, document: string, sha256: string): void {
  hedgesDb()
    .prepare(`INSERT OR IGNORE INTO hedge_receipts (hedge_id, document, sha256, created_at) VALUES (?, ?, ?, ?)`)
    .run(hedgeId, document, sha256, Date.now());
}

export function getReceipt(hedgeId: string): ReceiptRecord | null {
  return (hedgesDb().prepare(`SELECT ${receiptCols} FROM hedge_receipts WHERE hedge_id = ?`).get(hedgeId) as ReceiptRecord | undefined) ?? null;
}

/** Receipts not yet recorded on Solana, oldest first. */
export function unsealedReceipts(limit = 10): ReceiptRecord[] {
  return hedgesDb()
    .prepare(`SELECT ${receiptCols} FROM hedge_receipts WHERE signature IS NULL ORDER BY created_at LIMIT ?`)
    .all(limit) as unknown as ReceiptRecord[];
}

export function markReceiptSealed(hedgeId: string, cluster: string, signature: string): void {
  hedgesDb().prepare(`UPDATE hedge_receipts SET cluster = ?, signature = ?, sealed_at = ?, error = NULL WHERE hedge_id = ?`).run(cluster, signature, Date.now(), hedgeId);
}

export function markReceiptError(hedgeId: string, error: string): void {
  hedgesDb().prepare(`UPDATE hedge_receipts SET error = ? WHERE hedge_id = ?`).run(error.slice(0, 300), hedgeId);
}

/** Seal status per hedge, for the My hedges list. */
export function receiptStatuses(): Map<string, { sealed: boolean }> {
  const rows = hedgesDb().prepare(`SELECT hedge_id AS id, signature FROM hedge_receipts`).all() as { id: string; signature: string | null }[];
  return new Map(rows.map((r) => [r.id, { sealed: !!r.signature }]));
}
