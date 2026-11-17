// Records Gemini prediction-market odds every few minutes for odds-over-time charts.
// Run:  npm run collect            (loops forever)
//       npm run collect -- --once  (single snapshot)
// Env:  ODDS_INTERVAL_MIN (default 5), ODDS_CATEGORIES (default "Crypto,Commodities,Weather")

import { insertSnapshot, type OddsRow } from "../lib/odds/store";
import { GeminiClient } from "../lib/venues/gemini/client";
import { toMarkets, type GeminiEvent } from "../lib/venues/gemini/normalize";
import type { Market } from "../lib/types";

const intervalMin = Number(process.env.ODDS_INTERVAL_MIN ?? 5);
const categories = (process.env.ODDS_CATEGORIES ?? "Crypto,Commodities,Weather").split(",");
const once = process.argv.includes("--once");
const client = GeminiClient.fromEnv();

async function fetchAll(category: string): Promise<Market[]> {
  const out: Market[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client.publicGet<{ data: GeminiEvent[]; pagination?: { total?: number } }>(
      "/v1/prediction-markets/events",
      { status: "active", category, limit: 100, offset },
    );
    out.push(...page.data.flatMap(toMarkets));
    const total = page.pagination?.total ?? 0;
    if (page.data.length < 100 || offset + 100 >= total) break;
  }
  return out;
}

async function snapshot(): Promise<void> {
  const ts = Date.now();
  const rows: OddsRow[] = [];
  for (const cat of categories) {
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

async function main() {
  await snapshot();
  if (once) return;
  setInterval(() => snapshot().catch((e) => console.error("[collect]", e)), intervalMin * 60_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
