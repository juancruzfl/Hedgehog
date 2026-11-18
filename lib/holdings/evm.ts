import type { Holding } from "./index";

// Read-only Ethereum-compatible holdings (MetaMask, Coinbase Wallet, Rabby, ...) from a
// public 0x address: native ETH plus the tokens that track BTC or ETH, on Ethereum and
// Base. No signature or approval is ever requested. Token contracts verified on-chain.

interface Chain {
  name: string;
  rpc: string;
  /** contract -> asset it tracks, its symbol and decimals. Staked ETH counts ~1:1 (slightly understated). */
  tokens: Record<string, { asset: "BTC" | "ETH"; symbol: string; decimals: number }>;
}

export const EVM_CHAINS: Chain[] = [
  {
    name: "Ethereum",
    rpc: process.env.ETH_RPC_URL ?? "https://ethereum-rpc.publicnode.com",
    tokens: {
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": { asset: "ETH", symbol: "WETH", decimals: 18 },
      "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84": { asset: "ETH", symbol: "stETH", decimals: 18 },
      "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": { asset: "ETH", symbol: "wstETH", decimals: 18 },
      "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704": { asset: "ETH", symbol: "cbETH", decimals: 18 },
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": { asset: "BTC", symbol: "WBTC", decimals: 8 },
      "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf": { asset: "BTC", symbol: "cbBTC", decimals: 8 },
    },
  },
  {
    name: "Base",
    rpc: process.env.BASE_RPC_URL ?? "https://base-rpc.publicnode.com",
    tokens: {
      "0x4200000000000000000000000000000000000006": { asset: "ETH", symbol: "WETH", decimals: 18 },
      "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22": { asset: "ETH", symbol: "cbETH", decimals: 18 },
      "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf": { asset: "BTC", symbol: "cbBTC", decimals: 8 },
    },
  },
];

/** Below these, a balance is leftover dust (around a dollar or less) and isn't worth showing. */
const DUST: Record<"BTC" | "ETH", number> = { BTC: 0.00002, ETH: 0.0005 };

export const isEvmAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

/** A uint256 hex result as a decimal amount. */
export function fromUnits(hex: string | undefined, decimals: number): number {
  if (!hex || hex === "0x") return 0;
  const v = BigInt(hex);
  const base = BigInt(10) ** BigInt(decimals);
  return Number(v / base) + Number(v % base) / Number(base);
}

/** ERC-20 balanceOf(address) call data. */
export const balanceOfData = (address: string) => "0x70a08231" + address.trim().toLowerCase().replace(/^0x/, "").padStart(64, "0");

async function readChain(chain: Chain, address: string): Promise<Holding[]> {
  const tokens = Object.entries(chain.tokens);
  const calls = [
    { jsonrpc: "2.0", id: 0, method: "eth_getBalance", params: [address, "latest"] },
    ...tokens.map(([to], i) => ({ jsonrpc: "2.0", id: i + 1, method: "eth_call", params: [{ to, data: balanceOfData(address) }, "latest"] })),
  ];
  const res = await fetch(chain.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${chain.name} RPC failed (${res.status})`);
  const out = (await res.json()) as { id: number; result?: string; error?: { message: string } }[];
  const byId = new Map(out.map((r) => [r.id, r.result]));
  const holdings: Holding[] = [];
  const eth = fromUnits(byId.get(0), 18);
  if (eth > 0) holdings.push({ asset: "ETH", quantity: eth, source: "evm", detail: `ETH on ${chain.name}` });
  tokens.forEach(([, t], i) => {
    const q = fromUnits(byId.get(i + 1), t.decimals);
    if (q > 0) holdings.push({ asset: t.asset, quantity: q, source: "evm", detail: `${t.symbol} on ${chain.name}` });
  });
  return holdings;
}

/**
 * One holding per coin for the whole wallet, e.g. ETH = native ETH + WETH + staked ETH on
 * Ethereum and Base, with the parts listed in `detail`. Dust is left out.
 */
export function mergeByAsset(parts: Holding[]): Holding[] {
  const out: Holding[] = [];
  for (const asset of ["ETH", "BTC"] as const) {
    const mine = parts.filter((p) => p.asset === asset && p.quantity >= DUST[asset] / 10);
    const quantity = mine.reduce((s, p) => s + p.quantity, 0);
    if (quantity < DUST[asset]) continue;
    // "ETH on Ethereum", "WETH on Ethereum" -> "ETH + WETH on Ethereum"
    const byChain = new Map<string, string[]>();
    for (const p of mine) {
      const [sym, chain] = (p.detail ?? "").split(" on ");
      byChain.set(chain, [...(byChain.get(chain) ?? []), sym]);
    }
    const detail = [...byChain.entries()].map(([chain, syms]) => `${syms.join(" + ")} on ${chain}`).join(", ");
    out.push({ asset, quantity, source: "evm", detail });
  }
  return out;
}

export async function getEvmHoldings(address: string): Promise<Holding[]> {
  if (!isEvmAddress(address)) throw new Error("That doesn't look like an Ethereum address (0x…)");
  const results = await Promise.allSettled(EVM_CHAINS.map((c) => readChain(c, address.trim())));
  if (results.every((r) => r.status === "rejected")) throw new Error("Couldn't reach the Ethereum network. Try again in a moment.");
  return mergeByAsset(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
}
