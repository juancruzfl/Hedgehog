import { hedgeMemoFor } from "@/lib/archive/merkle";
import { archiveEnabled } from "@/lib/archive/anchor";
import { cluster, writeMemo } from "@/lib/archive/solana";
import { getReceipt, markReceiptError, markReceiptSealed, unsealedReceipts } from "./store";

// Records hedge receipts on Solana: one memo per hedge, written as soon as it's approved
// (not in the hourly batch), so the time on-chain is the time of the hedge.

const inFlight = new Map<string, Promise<void>>();

export function sealReceipt(hedgeId: string): Promise<void> {
  if (!archiveEnabled()) return Promise.resolve();
  const running = inFlight.get(hedgeId);
  if (running) return running;
  const p = (async () => {
    const r = getReceipt(hedgeId);
    if (!r || r.signature) return;
    try {
      const sig = await writeMemo(hedgeMemoFor(hedgeId, r.sha256));
      markReceiptSealed(hedgeId, cluster(), sig);
      console.log(`[receipt] ${hedgeId} sealed tx=${sig.slice(0, 12)}…`);
    } catch (e) {
      markReceiptError(hedgeId, (e as Error).message);
      console.error(`[receipt] ${hedgeId} not sealed:`, (e as Error).message);
    }
  })().finally(() => inFlight.delete(hedgeId));
  inFlight.set(hedgeId, p);
  return p;
}

/** Retries receipts that couldn't be sealed (empty wallet, RPC trouble). Run by the collector. */
export async function sealPendingReceipts(max = 10): Promise<void> {
  for (const r of unsealedReceipts(max)) await sealReceipt(r.hedgeId);
}
