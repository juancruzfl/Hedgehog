import { parseMemo, rootFromProof, type ArchiveReading, type ProofStep } from "./merkle";

// Browser-side check that one archived reading is part of the fingerprint recorded on
// Solana. It talks to Solana's public RPC directly, so it doesn't have to trust Hedgehog.

const PUBLIC_RPC: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

export interface VerifyResult {
  computedRoot: string;
  onChain: { root: string; hourStart: number; count: number } | null;
  slotTime: number | null; // when Solana recorded it (ms)
  matches: boolean;
}

/** Reads the Memo from a transaction via Solana's public RPC. */
export async function readMemo(signature: string, cluster: string): Promise<{ memo: string | null; blockTime: number | null }> {
  const res = await fetch(PUBLIC_RPC[cluster] ?? PUBLIC_RPC.devnet, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }),
  });
  const body = (await res.json()) as { result?: { blockTime?: number; meta?: { logMessages?: string[] } } | null };
  const logs = body.result?.meta?.logMessages ?? [];
  return { memo: logs.find((l) => l.includes("hedgehog-odds v1")) ?? null, blockTime: body.result?.blockTime ? body.result.blockTime * 1000 : null };
}

export async function verifyReading(reading: ArchiveReading, proof: ProofStep[], signature: string, cluster: string): Promise<VerifyResult> {
  const [computedRoot, chain] = await Promise.all([rootFromProof(reading, proof), readMemo(signature, cluster)]);
  const onChain = chain.memo ? parseMemo(chain.memo) : null;
  const hourStart = Math.floor(reading.ts / 3600_000) * 3600_000;
  return {
    computedRoot,
    onChain,
    slotTime: chain.blockTime,
    matches: !!onChain && onChain.root === computedRoot && onChain.hourStart === hourStart,
  };
}
