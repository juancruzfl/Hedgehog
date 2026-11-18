import type { Holding } from "./index";

// Read-only Bitcoin holdings from a public address (any wallet: Ledger, Sparrow, Xverse, …),
// using the mempool.space explorer API with blockstream.info as a fallback.
// Counts confirmed plus pending (mempool) funds.

const EXPLORERS = [process.env.BTC_EXPLORER_URL ?? "https://mempool.space/api", "https://blockstream.info/api"];

const BECH32 = /^(bc1)[02-9ac-hj-np-z]{11,71}$/i;
const LEGACY = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
export const isBitcoinAddress = (s: string) => BECH32.test(s.trim()) || LEGACY.test(s.trim());

interface Stats {
  funded_txo_sum: number;
  spent_txo_sum: number;
}

/** Satoshis held, from an explorer's address stats. */
export const satsHeld = (d: { chain_stats: Stats; mempool_stats?: Stats }) =>
  d.chain_stats.funded_txo_sum - d.chain_stats.spent_txo_sum + (d.mempool_stats ? d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum : 0);

export async function getBitcoinHoldings(address: string): Promise<Holding[]> {
  const a = address.trim();
  if (!isBitcoinAddress(a)) throw new Error("That doesn't look like a Bitcoin address (bc1…, 1… or 3…)");
  let lastError = "";
  for (const base of EXPLORERS) {
    try {
      const res = await fetch(`${base}/address/${encodeURIComponent(a)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (res.status === 400) throw new Error("That Bitcoin address isn't valid");
      if (!res.ok) throw new Error(`explorer ${res.status}`);
      const btc = satsHeld(await res.json()) / 1e8;
      return btc > 0 ? [{ asset: "BTC", quantity: btc, source: "bitcoin", detail: "BTC at a Bitcoin address" }] : [];
    } catch (e) {
      lastError = (e as Error).message;
      if (lastError.includes("isn't valid")) throw e;
    }
  }
  throw new Error(`Couldn't reach the Bitcoin network (${lastError}). Try again in a moment.`);
}
