// Pre-demo readiness check. Run: npm run demo:check
// Verifies everything the live demo depends on and prints what to fix.

import { getAI } from "../lib/ai";
import { paperPortfolio } from "../lib/hedges/paper";
import { listHedges } from "../lib/hedges/store";
import { upcomingGames } from "../lib/landing/board";
import { oddsDb } from "../lib/odds/store";
import { GeminiClient } from "../lib/venues/gemini/client";
import { GeminiAdapter } from "../lib/venues/gemini/adapter";

type Result = { ok: boolean | "warn"; label: string; detail: string };
const results: Result[] = [];
const check = async (label: string, fn: () => Promise<Omit<Result, "label">>) => {
  try {
    results.push({ label, ...(await fn()) });
  } catch (e) {
    results.push({ label, ok: false, detail: (e as Error).message.slice(0, 160) });
  }
};
const hours = (ms: number) => `${(ms / 3600_000).toFixed(1)}h`;

async function main() {
  const venue = new GeminiAdapter();

  await check("Odds collector", async () => {
    const row = oddsDb().prepare("SELECT MIN(ts) AS first, MAX(ts) AS last, COUNT(*) AS n FROM odds").get() as { first: number; last: number; n: number };
    if (!row?.n) return { ok: false, detail: "No odds recorded. Start it: npm run collect" };
    const age = Date.now() - row.last;
    return {
      ok: age < 15 * 60_000 ? true : false,
      detail: `${hours(row.last - row.first)} of history, last snapshot ${Math.round(age / 60_000)} min ago${age >= 15 * 60_000 ? ". Restart: npm run collect" : ""}`,
    };
  });

  await check("Gemini market data", async () => {
    const markets = await venue.listMarkets({ category: ["Crypto"], search: "SOL", limit: 20 });
    return { ok: markets.length > 0, detail: `${markets.length} SOL markets listed` };
  });

  await check("Next NFL game (promo demo)", async () => {
    const [g] = await upcomingGames(venue);
    if (!g) return { ok: false, detail: "No upcoming NFL game listed. Use a fuel or gold example instead" };
    const until = g.start.getTime() - Date.now();
    return {
      ok: until > 2 * 3600_000 ? true : "warn",
      detail: `${g.m.title}, kicks off in ${hours(until)}${until <= 2 * 3600_000 ? ". Starting soon, may close mid-demo" : ""}`,
    };
  });

  await check("AI provider", async () => {
    const parsed = await getAI().parseRisk("Half-price wings if the home team wins Sunday, about 500 orders at $6 off.", new Date());
    return { ok: true, detail: `parsed "${parsed.profile.condition}"` };
  });
  const ai = results[results.length - 1];
  if (!ai.ok) {
    ai.ok = "warn";
    ai.detail += ". Fallback matcher still handles game-day promos and fuel/metal costs";
  }

  await check("Gemini API key", async () => {
    const client = GeminiClient.fromEnv();
    if (!client.hasCredentials) return { ok: "warn", detail: "Not set. Paper trading still works; balance import won't" };
    const s = await client.privateGet<{ hasAcceptedLatest?: boolean }>("/v1/prediction-markets/terms/status");
    return { ok: true, detail: `signed requests work (${client.tradingEnv}); terms accepted: ${s.hasAcceptedLatest ?? "unknown"}` };
  });

  await check("Execution mode", async () => {
    const mode = process.env.HEDGE_EXECUTION === "live" ? "live" : "paper";
    return { ok: true, detail: mode === "paper" ? "paper (live Gemini prices, no real money)" : `LIVE orders to ${process.env.GEMINI_TRADING_ENV ?? "sandbox"}` };
  });

  await check("Settled hedges to show", async () => {
    const hedges = listHedges();
    const p = await paperPortfolio(venue, hedges);
    const settled = Object.values(p.outcomes).filter((o) => o.settled).length;
    return {
      ok: settled > 0 ? true : "warn",
      detail: `${hedges.length} hedges, ${settled} settled, ${p.open.length} open${settled ? "" : ". Approve a short-dated paper hedge a day ahead"}`,
    };
  });

  const icon = { true: "✓", false: "✗", warn: "!" } as const;
  for (const r of results) console.log(`${icon[String(r.ok) as keyof typeof icon]} ${r.label.padEnd(28)} ${r.detail}`);
  const failed = results.filter((r) => r.ok === false).length;
  console.log(failed ? `\n${failed} item(s) to fix before the demo.` : "\nReady for the demo.");
  process.exit(failed ? 1 : 0);
}

main();
