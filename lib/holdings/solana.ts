import type { Holding } from "./index";

// Read-only Solana holdings from a public address (no wallet signature needed).
// Native SOL plus the SPL tokens that map to assets Gemini lists markets for.

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** SPL mint -> the asset its price tracks. Liquid-staking SOL counts ~1:1 (slightly understated). */
export const SOLANA_MINTS: Record<string, { asset: string; name: string }> = {
  cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij: { asset: "BTC", name: "cbBTC" },
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": { asset: "BTC", name: "WBTC (Wormhole)" },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { asset: "ETH", name: "WETH (Wormhole)" },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { asset: "SOL", name: "mSOL" },
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: { asset: "SOL", name: "JitoSOL" },
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isSolanaAddress = (s: string) => BASE58.test(s.trim());

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(`Solana RPC ${method} failed: ${body.error?.message ?? res.status}`);
  return body.result as T;
}

interface TokenAccounts {
  value: { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number | null } } } } } }[];
}

export async function getSolanaHoldings(address: string): Promise<Holding[]> {
  if (!isSolanaAddress(address)) throw new Error("That doesn't look like a Solana address");
  const [lamports, tokens] = await Promise.all([
    rpc<{ value: number }>("getBalance", [address]),
    rpc<TokenAccounts>("getTokenAccountsByOwner", [address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }]),
  ]);

  const out: Holding[] = [];
  if (lamports.value > 0) {
    out.push({ asset: "SOL", quantity: lamports.value / 1e9, source: "solana", detail: "SOL in Solana wallet" });
  }
  for (const t of tokens.value) {
    const { mint, tokenAmount } = t.account.data.parsed.info;
    const known = SOLANA_MINTS[mint];
    const qty = tokenAmount.uiAmount ?? 0;
    if (known && qty > 0) {
      out.push({ asset: known.asset, quantity: qty, source: "solana", detail: `${known.name} in Solana wallet` });
    }
  }
  return out;
}
