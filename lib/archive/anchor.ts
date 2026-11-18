import { buildLevels, memoFor, rootOf } from "./merkle";
import { cluster, writeMemo } from "./solana";
import { HOUR, firstReadingTs, getBatch, readingsForHour, saveBatch } from "./store";

// Fingerprints every finished hour of readings and records it on Solana.
// An hour counts as finished 10 minutes after it ends, so a snapshot that started just
// before the hour boundary has been fully written before the hour is sealed.

const GRACE_MS = 10 * 60_000;
export const archiveEnabled = () => process.env.ARCHIVE_ANCHOR === "1";

let running: Promise<number> | null = null;

/** Anchors up to `max` unanchored finished hours, oldest first. Returns how many were recorded. */
export function anchorPending(max = 48): Promise<number> {
  running ??= run(max).finally(() => (running = null));
  return running;
}

async function run(max: number): Promise<number> {
  const first = firstReadingTs();
  if (first === null) return 0;
  const lastFinished = Math.floor((Date.now() - GRACE_MS) / HOUR) * HOUR - HOUR; // start of the latest sealed hour
  let done = 0;
  for (let h = Math.floor(first / HOUR) * HOUR; h <= lastFinished && done < max; h += HOUR) {
    const existing = getBatch(h);
    if (existing?.signature) continue;
    const rows = readingsForHour(h);
    if (rows.length === 0) continue; // collector was off (e.g. exchange maintenance): nothing to seal
    const root = rootOf(await buildLevels(rows));
    try {
      const signature = await writeMemo(memoFor(h, rows.length, root));
      saveBatch({ hourStart: h, count: rows.length, root, cluster: cluster(), signature, anchoredAt: Date.now(), error: null });
      console.log(`[archive] ${new Date(h).toISOString()} n=${rows.length} root=${root.slice(0, 12)}… tx=${signature.slice(0, 12)}…`);
      done++;
    } catch (e) {
      // Keep the fingerprint so the page can show it; retry the transaction next run.
      saveBatch({ hourStart: h, count: rows.length, root, cluster: cluster(), signature: null, anchoredAt: null, error: (e as Error).message.slice(0, 300) });
      console.error(`[archive] ${new Date(h).toISOString()} not recorded:`, (e as Error).message);
      break; // usually an empty wallet or RPC trouble; try again on the next snapshot
    }
  }
  return done;
}
