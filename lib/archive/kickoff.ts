import { buildLevels, kickoffMemoFor, rootOf } from "./merkle";
import { cluster, writeMemo } from "./solana";
import { gamesAwaitingKickoffSeal, lastReadingsBefore, saveKickoffSeal } from "./kickoff-store";

// Kickoff seals: when a tracked game starts, fingerprint its markets' last readings from
// before play began and record that on Solana. The hourly batch can straddle kickoff; this
// pins down exactly what the odds were before the game started.

let running: Promise<number> | null = null;

export function sealKickoffs(now = Date.now()): Promise<number> {
  running ??= run(now).finally(() => (running = null));
  return running;
}

async function run(now: number): Promise<number> {
  let done = 0;
  for (const g of gamesAwaitingKickoffSeal(now)) {
    const last = lastReadingsBefore(g.marketIds, g.startTime);
    if (!last || !last.rows.length) continue; // never recorded before kickoff: nothing honest to seal
    const root = rootOf(await buildLevels(last.rows));
    const base = { ticker: g.ticker, title: g.title, startTime: g.startTime, readingTs: last.ts, count: last.rows.length, root, cluster: cluster() };
    try {
      const signature = await writeMemo(kickoffMemoFor(g.ticker, g.startTime, last.ts, last.rows.length, root));
      saveKickoffSeal({ ...base, signature, sealedAt: Date.now(), error: null });
      console.log(`[kickoff] ${g.title} n=${last.rows.length} tx=${signature.slice(0, 12)}…`);
      done++;
    } catch (e) {
      saveKickoffSeal({ ...base, signature: null, sealedAt: null, error: (e as Error).message.slice(0, 300) });
      console.error(`[kickoff] ${g.title} not sealed:`, (e as Error).message);
      break; // usually an empty wallet or RPC trouble; try again next snapshot
    }
  }
  return done;
}
