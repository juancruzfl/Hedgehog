// Odds snapshot collector, shared by `npm run collect` and the hosted server
// (instrumentation.ts starts it in-process when ENABLE_COLLECTOR=1).

import { insertSnapshot, type OddsRow } from "./store";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import type { Market } from "@/lib/types";

const categories = () => (process.env.ODDS_CATEGORIES ?? "Crypto,Commodities,Weather").split(",");
const client = () => GeminiClient.fromEnv();

async function fetchAll(category: string): Promise<Market[]> {
  const out: Market[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client().publicGet<{ data: GeminiEvent[]; pagination?: { total?: number } }>(
      "/v1/prediction-markets/events",
      { status: "active", category, limit: 100, offset },
    );
    out.push(...page.data.flatMap(toMarkets));
    const total = page.pagination?.total ?? 0;
    if (page.data.length < 100 || offset + 100 >= total) break;
  }
  return out;
}

export async function snapshot(): Promise<void> {
  const ts = Date.now();
  const rows: OddsRow[] = [];
  for (const cat of categories()) {
    let markets: Market[];
    try {
      markets = await fetchAll(cat);
    } catch (e) {
      console.error(`[collect] ${cat} failed:`, (e as Error).message);
      continue;
    }
    for (const m of markets) {
      for (const c of m.contracts) {
        if (c.quote.yesBid === null && c.quote.yesAsk === null && c.quote.last === null) continue;
        rows.push({
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
        });
      }
    }
  }
  insertSnapshot(rows);
  console.log(`[collect] ${new Date(ts).toISOString()} stored ${rows.length} contract quotes`);
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
