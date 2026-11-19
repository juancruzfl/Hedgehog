// Odds snapshot collector, shared by `npm run collect` and the hosted server
// (instrumentation.ts starts it in-process when ENABLE_COLLECTOR=1).

import { insertSnapshot, unwatchMarket, watchedMarketIds, type OddsRow } from "./store";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import type { Market } from "@/lib/types";

const categories = () => (process.env.ODDS_CATEGORIES ?? "Crypto,Commodities,Weather,Sports").split(",");

/**
 * Sports has hundreds of child markets per game (spreads, totals, props). Only the game
 * winner (moneyline, ticker ending "-M") is recorded for every game: it's what promos are
 * tied to, and it's what the past-promo look-back needs. Other game markets are recorded
 * once someone looks at them (the watch list).
 */
export const keepCollected = (m: Market): boolean => m.category !== "Sports" || /-M$/.test(m.id);
const client = () => GeminiClient.fromEnv();

async function fetchAll(category: string): Promise<Market[]> {
  const out: Market[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client().publicGet<{ data: GeminiEvent[]; pagination?: { total?: number } }>(
      "/v1/prediction-markets/events",
      { status: "active", category, limit: 100, offset },
    );
    out.push(...page.data.flatMap(toMarkets).filter(keepCollected));
    const total = page.pagination?.total ?? 0;
    if (page.data.length < 100 || offset + 100 >= total) break;
  }
  return out;
}

/** Markets someone looked at that aren't in the collected categories (e.g. a game). */
async function fetchWatched(ids: string[]): Promise<Market[]> {
  const out: Market[] = [];
  for (const id of ids) {
    try {
      const ev = await client().publicGet<GeminiEvent>(`/v1/prediction-markets/events/${encodeURIComponent(id)}`);
      const m = toMarkets(ev)[0];
      // Settled or gone: stop watching it.
      if (!m || m.contracts.every((c) => Date.parse(c.expiry) < Date.now())) unwatchMarket(id);
      else out.push(m);
    } catch (e) {
      console.error(`[collect] watched ${id} failed:`, (e as Error).message);
    }
  }
  return out;
}

const toRows = (ts: number, markets: Market[]): OddsRow[] =>
  markets.flatMap((m) =>
    m.contracts
      .filter((c) => !(c.quote.yesBid === null && c.quote.yesAsk === null && c.quote.last === null))
      .map((c) => ({
        ts,
        symbol: c.symbol,
        marketId: m.id,
        marketTitle: m.title,
        category: m.category,
        label: c.label,
        strikeType: c.strike?.type ?? null,
        strikeValue: c.strike?.value ?? null,
        expiry: c.expiry,
        yesBid: c.quote.yesBid,
        yesAsk: c.quote.yesAsk,
        last: c.quote.last,
      })),
  );

/** Record specific markets right now (used when they're first watched). */
export async function snapshotMarkets(ids: string[]): Promise<void> {
  insertSnapshot(toRows(Date.now(), await fetchWatched(ids)));
}

export async function snapshot(): Promise<void> {
  const ts = Date.now();
  const rows: OddsRow[] = [];
  const seen = new Set<string>();
  for (const cat of categories()) {
    let markets: Market[];
    try {
      markets = await fetchAll(cat);
    } catch (e) {
      console.error(`[collect] ${cat} failed:`, (e as Error).message);
      continue;
    }
    markets.forEach((m) => seen.add(m.id));
    rows.push(...toRows(ts, markets));
  }
  rows.push(...toRows(ts, await fetchWatched(watchedMarketIds().filter((id) => !seen.has(id)))));
  insertSnapshot(rows);
  console.log(`[collect] ${new Date(ts).toISOString()} stored ${rows.length} contract quotes`);
  // Seal any finished hour into the on-chain archive (Solana fingerprints). Loaded lazily so
  // the collector doesn't pull in the Solana library when the archive is switched off.
  if (process.env.ARCHIVE_ANCHOR === "1") {
    const { anchorPending } = await import("@/lib/archive/anchor");
    anchorPending().catch((e) => console.error("[archive]", (e as Error).message));
  }
}

let started = false;

/** Takes a snapshot now and then every ODDS_INTERVAL_MIN minutes (default 5). Idempotent. */
export function startCollector(): void {
  if (started) return;
  started = true;
  const every = Number(process.env.ODDS_INTERVAL_MIN ?? 5) * 60_000;
  const run = () => snapshot().catch((e) => console.error("[collect]", (e as Error).message));
  void run();
  setInterval(run, every).unref?.();
}
