// Odds snapshot collector, shared by `npm run collect` and the hosted server
// (instrumentation.ts starts it in-process when ENABLE_COLLECTOR=1).

import { insertSnapshot, rowFromContract, unwatchMarket, watchedMarketIds, type OddsRow } from "./store";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import type { Market } from "@/lib/types";
import { upsertGames } from "@/lib/archive/kickoff-store";
import { isCoreMarket, pickGames, withParent } from "./sports";

const categories = () => (process.env.ODDS_CATEGORIES ?? "Crypto,Commodities,Weather").split(",");
const client = () => GeminiClient.fromEnv();

/** Every active event in a category, raw (volume and start time live on the event). */
async function fetchEvents(category: string): Promise<GeminiEvent[]> {
  const out: GeminiEvent[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client().publicGet<{ data: GeminiEvent[]; pagination?: { total?: number } }>(
      "/v1/prediction-markets/events",
      { status: "active", category, limit: 100, offset },
    );
    out.push(...page.data);
    const total = page.pagination?.total ?? 0;
    if (page.data.length < 100 || offset + 100 >= total) break;
  }
  return out;
}

const fetchAll = async (category: string): Promise<Market[]> => (await fetchEvents(category)).flatMap(toMarkets);

/**
 * Sports games worth recording before anyone opens them (lib/odds/sports.ts), as markets
 * ready to snapshot. Also remembers each game's start time for its kickoff seal.
 */
async function fetchSportsGames(now: number): Promise<Market[]> {
  const picked = pickGames(await fetchEvents("Sports"), now);
  // Gemini's list can leave out a game itself (seen with NFL) while listing its quarter and
  // prop markets; ask for the game directly then.
  const games = (
    await Promise.all(
      picked.map(async (g) =>
        g.hasParent
          ? g
          : withParent(g, await client().publicGet<GeminiEvent>(`/v1/prediction-markets/events/${encodeURIComponent(`${g.key}-M`)}`).catch(() => null)),
      ),
    )
  ).filter((g) => g.markets.length > 0);
  upsertGames(games.map((g) => ({ ticker: g.key, title: g.title, startTime: g.startTime, marketIds: g.marketIds })));
  // A game's core markets, once each (a game nests its total and spread, which are also listed on their own).
  const out = new Map<string, Market>();
  for (const g of games) {
    for (const ev of g.markets) {
      for (const m of toMarkets({ ...ev, category: ev.category ?? "Sports", events: (ev.events ?? []).filter(isCoreMarket) })) {
        if (g.marketIds.includes(m.id)) out.set(m.id, m);
      }
    }
  }
  return [...out.values()];
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
      .map((c) => ({ ...rowFromContract(ts, c), marketId: m.id, marketTitle: m.title, category: m.category })),
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
  // Upcoming games: the busiest plus our customers' teams (SPORTS_TRACKING=0 turns this off).
  if (process.env.SPORTS_TRACKING !== "0") {
    try {
      const games = (await fetchSportsGames(ts)).filter((m) => !seen.has(m.id));
      games.forEach((m) => seen.add(m.id));
      rows.push(...toRows(ts, games));
    } catch (e) {
      console.error("[collect] sports games failed:", (e as Error).message);
    }
  }
  rows.push(...toRows(ts, await fetchWatched(watchedMarketIds().filter((id) => !seen.has(id)))));
  insertSnapshot(rows);
  console.log(`[collect] ${new Date(ts).toISOString()} stored ${rows.length} contract quotes`);
  // Seal any finished hour into the on-chain archive (Solana fingerprints). Loaded lazily so
  // the collector doesn't pull in the Solana library when the archive is switched off.
  // Kickoff seals for games that just started, and any hedge receipts still waiting.
  if (process.env.ARCHIVE_ANCHOR === "1") {
    const [{ anchorPending }, { sealKickoffs }, { sealPendingReceipts }] = await Promise.all([
      import("@/lib/archive/anchor"),
      import("@/lib/archive/kickoff"),
      import("@/lib/hedges/seal"),
    ]);
    // One after another: they share the archive wallet, so parallel sends could clash.
    void (async () => {
      for (const job of [() => sealKickoffs(), () => anchorPending(), () => sealPendingReceipts()]) {
        await job().catch((e) => console.error("[archive]", (e as Error).message));
      }
    })();
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
