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
  if (isScopeError(e))
    return `${name} couldn't approve the connection because of one of its networks (a known ${name} issue). Update ${name}, or paste your 0x address below instead.`;
  if (err.code === 4001) return `You declined the connection in ${name}. Try again and choose Connect.`;
  if (err.code === -32002)
    return `${name} already has a connection request waiting. Click the ${name} icon in your browser's toolbar to approve it, then try again.`;
  if (err.code === 4100) return `${name} is locked or hasn't allowed this site yet. Unlock ${name} and try again.`;
  if (err.code === 4900 || err.code === 4901) return `${name} isn't connected to a network right now. Open ${name}, then try again.`;
  const msg = err.message?.trim();
  return msg ? `${name} couldn't connect: ${msg}` : `${name} couldn't connect. Open ${name} to check it's unlocked, then try again.`;
}

/** Ethereum mainnet and Base: the only chains Hedgehog reads. */
export const READ_CHAIN_IDS = ["0x1", "0x2105"];

/**
 * MetaMask's multichain permission check failing (it pre-selects every network it knows,
 * including ones like Tron that aren't set up, then rejects its own approval).
 * A plain decline (4001) is not this, even if its message mentions scopes.
 */
export function isScopeError(e: unknown): boolean {
  const err = (e ?? {}) as { code?: number; message?: string };
  return err.code !== 4001 && /endowment:caip25|authorizedScopes/.test(err.message ?? "");
}

/**
 * The wallet's account address, read-only.
 * 1. An already-approved account, with no popup.
 * 2. Ask for accounts on Ethereum and Base only, so wallets like MetaMask don't pull in
 *    networks they can't approve.
 * 3. Wallets that don't support that scoped request: the classic eth_requestAccounts.
 */
export async function requestEvmAccount(w: EvmWallet): Promise<string> {
  const accounts = async () => ((await w.provider.request({ method: "eth_accounts" }).catch(() => [])) as string[])?.[0];
  const existing = await accounts();
  if (existing) return existing;

  try {
    await w.provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {}, "endowment:permitted-chains": { caveats: [{ type: "restrictNetworkSwitching", value: READ_CHAIN_IDS }] } }],
    });
    const scoped = await accounts();
    if (scoped) return scoped;
  } catch (e) {
    const code = (e as { code?: number })?.code;
    if (code === 4001 || code === -32002) throw e; // declined, or a request already waiting
    // Otherwise the wallet doesn't support the scoped request: fall back below.
  }

  const list = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!list?.[0]) throw { code: 4100, message: "No account was shared" };
  return list[0];
}
