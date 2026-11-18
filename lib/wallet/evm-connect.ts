// Connecting to an Ethereum browser wallet (EIP-1193) to get its public address only.

/** Minimal EIP-1193 provider: all Hedgehog ever asks for is the account address. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
}

export interface EvmWallet {
  id: string;
  name: string;
  /** Data-URI icon provided by the wallet itself. */
  icon?: string;
  provider: Eip1193Provider;
}

/** A plain-English reason a wallet connection failed, from the wallet's EIP-1193 error. */
export function walletErrorMessage(e: unknown, name: string): string {
  const err = (e ?? {}) as { code?: number; message?: string };
  if (err.code === 4001) return `You declined the connection in ${name}. Try again and choose Connect.`;
  if (err.code === -32002)
    return `${name} already has a connection request waiting. Click the ${name} icon in your browser's toolbar to approve it, then try again.`;
  if (err.code === 4100) return `${name} is locked or hasn't allowed this site yet. Unlock ${name} and try again.`;
  if (err.code === 4900 || err.code === 4901) return `${name} isn't connected to a network right now. Open ${name}, then try again.`;
  const msg = err.message?.trim();
  return msg ? `${name} couldn't connect: ${msg}` : `${name} couldn't connect. Open ${name} to check it's unlocked, then try again.`;
}

/**
 * The wallet's account address. Uses the already-approved account if there is one (no popup),
 * otherwise asks the wallet to connect.
 */
export async function requestEvmAccount(w: EvmWallet): Promise<string> {
  const existing = (await w.provider.request({ method: "eth_accounts" }).catch(() => [])) as string[];
  if (existing?.[0]) return existing[0];
  const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw { code: 4100, message: "No account was shared" };
  return accounts[0];
}
