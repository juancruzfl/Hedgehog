import { isBitcoinAddress } from "./bitcoin";
import { isEvmAddress } from "./evm";
import { isSolanaAddress } from "./solana";

export type WalletNetwork = "solana" | "evm" | "bitcoin";

export const NETWORK_LABEL: Record<WalletNetwork, string> = { solana: "Solana", evm: "Ethereum", bitcoin: "Bitcoin" };

/**
 * Which network a pasted address belongs to. Order matters: Bitcoin legacy addresses
 * (1…/3…, ≤34 chars) also look like base58, so Bitcoin is checked before Solana,
 * whose addresses are 32-byte keys (almost always 43–44 characters).
 */
export function detectNetwork(input: string): WalletNetwork | null {
  const s = input.trim();
  if (isEvmAddress(s)) return "evm";
  if (isBitcoinAddress(s)) return "bitcoin";
  if (isSolanaAddress(s)) return "solana";
  return null;
}
