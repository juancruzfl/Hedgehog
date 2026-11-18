"use client";

import { useEffect, useState } from "react";
import type { Eip1193Provider, EvmWallet } from "@/lib/wallet/evm-connect";

export { requestEvmAccount, walletErrorMessage, type EvmWallet } from "@/lib/wallet/evm-connect";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Ethereum wallets installed in this browser (MetaMask, Coinbase Wallet, Rabby, …), found
 * through EIP-6963 so several can coexist. Falls back to window.ethereum for older wallets.
 */
export function useEvmWallets(): EvmWallet[] {
  const [wallets, setWallets] = useState<EvmWallet[]>([]);
  useEffect(() => {
    const found = new Map<string, EvmWallet>();
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider }>).detail;
      if (!d?.info || !d.provider) return;
      found.set(d.info.rdns || d.info.uuid, { id: d.info.rdns || d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider });
      setWallets([...found.values()]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    // Older wallets only inject window.ethereum.
    const t = setTimeout(() => {
      if (!found.size && window.ethereum) {
        setWallets([{ id: "injected", name: window.ethereum.isMetaMask ? "MetaMask" : "Browser wallet", provider: window.ethereum }]);
      }
    }, 400);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);
  return wallets;
}

