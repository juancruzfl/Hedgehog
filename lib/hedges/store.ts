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
