"use client";

import { useEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { qty, usd } from "@/lib/format";
import { useEvmWallets, type EvmWallet } from "@/components/useEvmWallets";
import { HEDGEABLE_ASSETS, isHedgeable, type Holding } from "@/lib/holdings";
import { detectNetwork, NETWORK_LABEL, type WalletNetwork } from "@/lib/holdings/detect";

/** What each network's reader looks for, shown under the address box. */
const READS: Record<WalletNetwork, string> = {
  solana: "SOL, plus BTC and ETH tokens held on Solana",
  evm: "ETH, WETH, staked ETH, WBTC and cbBTC on Ethereum and Base",
  bitcoin: "the BTC at this address",
};

declare global {
  interface Window {
    phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString(): string } }> } };
  }
}

export type Method = "wallet" | "gemini" | "manual";

const SOURCE_LABEL: Record<Holding["source"], string> = {
  solana: "Solana wallet",
  evm: "Ethereum wallet",
  bitcoin: "Bitcoin address",
  gemini: "Gemini",
  manual: "Entered by you",
};

const METHODS: { id: Method; title: string; body: string; icon: React.ReactNode }[] = [
  {
    id: "wallet",
    title: "Connect wallet",
    body: "Solana, Ethereum or Bitcoin. Nothing to sign.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
        <path d="M4 7.5V17a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5Z" />
        <circle cx="16" cy="14" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "gemini",
    title: "Import from Gemini",
    body: "Pull in the crypto you keep on Gemini.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4v11m0 0-4-4m4 4 4-4" />
        <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
      </svg>
    ),
  },
  {
    id: "manual",
    title: "Enter manually",
    body: "Type a coin and how much you hold.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        <path d="m13.5 8.5 3 3" />
      </svg>
    ),
  },
];

export function HoldingsDialog({
  open,
  onClose,
  holdings,
  onChange,
  prices,
  initialMethod = null,
  initialAsset = null,
}: {
  open: boolean;
  onClose: () => void;
  holdings: Holding[];
  onChange: (h: Holding[]) => void;
  prices: Record<string, number>;
  initialMethod?: Method | null;
  initialAsset?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState<Method | null>(initialMethod);
  const [asset, setAsset] = useState<string>(initialAsset && isHedgeable(initialAsset) ? initialAsset : "SOL");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  // Drive the native <dialog>: modal focus handling, Esc to close, page behind is inert.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (open) setMessage(null);
  }, [open]);

  const replaceSource = (source: Holding["source"], next: Holding[]) => onChange([...holdings.filter((h) => h.source !== source), ...next]);

  function addManual() {
    const n = Number(amount);
    if (!(n > 0)) return setMessage({ kind: "error", text: "Enter how much you hold, e.g. 20." });
    onChange([...holdings.filter((h) => !(h.source === "manual" && h.asset === asset)), { asset, quantity: n, source: "manual" }]);
    setAmount("");
    setMessage({ kind: "info", text: `Added ${qty(n)} ${asset}.` });
  }

  async function readWallet(addr: string, known?: WalletNetwork) {
    const net = known ?? detectNetwork(addr);
    if (!net)
      return setMessage({ kind: "error", text: "We couldn't tell which network that is. Paste a Solana, Ethereum (0x…) or Bitcoin (bc1…, 1…, 3…) address." });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/holdings/${net}?address=${encodeURIComponent(addr)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const found = (body.holdings as Holding[]).filter((h) => isHedgeable(h.asset));
      replaceSource(net, found);
      setMessage(
        found.length
          ? { kind: "info", text: `Found ${found.length} asset${found.length > 1 ? "s" : ""} in your ${NETWORK_LABEL[net]} wallet.` }
          : { kind: "error", text: `We didn't find ${READS[net]} in that ${NETWORK_LABEL[net]} wallet.` },
      );
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function connectEvm(w: EvmWallet) {
    setMessage(null);
    try {
      const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accounts?.[0];
      if (!addr) throw new Error();
      setAddress(addr);
      await readWallet(addr, "evm");
    } catch {
      setMessage({ kind: "error", text: `The ${w.name} connection was cancelled.` });
    }
  }

  async function connectPhantom() {
    const phantom = window.phantom?.solana;
    if (!phantom) return setMessage({ kind: "error", text: "Phantom isn't installed in this browser. Paste your address below instead." });
    try {
      const { publicKey } = await phantom.connect();
      setAddress(publicKey.toString());
      await readWallet(publicKey.toString());
    } catch {
      setMessage({ kind: "error", text: "The wallet connection was cancelled." });
    }
  }

  async function importGemini() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/holdings/gemini");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      replaceSource("gemini", body.holdings);
      setMessage({
        kind: "info",
        text: `Imported ${body.holdings.length} asset${body.holdings.length === 1 ? "" : "s"} from Gemini${body.env === "sandbox" ? " (test account)" : ""}.`,
      });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const evmWallets = useEvmWallets();
  const pasted = detectNetwork(address);
  const total = holdings.reduce((s, h) => s + (prices[h.asset] ?? 0) * h.quantity, 0);
  const chosen = METHODS.find((m) => m.id === method);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="holdings-title"
      className="m-auto w-[min(640px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="holdings-title" className="text-xl font-bold">
              What do you hold?
            </h2>
            <p className="mt-0.5 text-sm text-text-2">Read-only. Hedgehog never moves your crypto or asks for a seed phrase.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-text-3 hover:bg-surface-2 hover:text-text">
            ✕
          </button>
        </div>

        {/* Choose a method */}
        {!chosen ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMethod(m.id);
                  setMessage(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-accent sm:flex-col sm:items-start sm:gap-0 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{m.icon}</span>
                <span className="sm:mt-3">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="mt-0.5 block text-sm text-text-2">{m.body}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold">
                <span className="text-accent">{chosen.icon}</span>
                {chosen.title}
              </p>
              <button
                onClick={() => {
                  setMethod(null);
                  setMessage(null);
                }}
                className="text-sm text-text-2 hover:text-text"
              >
                ← Other ways
              </button>
            </div>

            {method === "wallet" && (
              <div className="mt-4">
                {/* Wallets installed in this browser; Phantom (Solana) is always offered */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {evmWallets.map((w) => (
                    <button
                      key={w.id}
                      disabled={busy}
                      onClick={() => connectEvm(w)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3 font-semibold hover:border-accent disabled:opacity-40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- the wallet's own data-URI icon */}
                      {w.icon && <img src={w.icon} alt="" className="h-5 w-5" />}
                      {w.name}
                    </button>
                  ))}
                  {evmWallets.length === 0 && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        setMessage({
                          kind: "error",
                          text: "No Ethereum wallet (like MetaMask) is installed in this browser. Paste your 0x address below instead.",
                        })
                      }
                      className="rounded-xl border border-border bg-surface py-3 font-semibold hover:border-accent disabled:opacity-40"
                    >
                      MetaMask
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={connectPhantom}
                    className="rounded-xl border border-border bg-surface py-3 font-semibold hover:border-accent disabled:opacity-40"
                  >
                    Phantom
                  </button>
                </div>
                <div className="my-3 flex items-center gap-3 text-xs text-text-3">
                  <span className="h-px flex-1 bg-border" /> or paste any address <span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex gap-2">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && address.trim() && readWallet(address.trim())}
                    placeholder="Solana, Ethereum or Bitcoin address"
                    aria-label="Wallet address"
                    aria-describedby="wallet-network"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
                  />
                  <button
                    disabled={busy || !address.trim()}
                    onClick={() => readWallet(address.trim())}
                    className="rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:border-text-3 disabled:opacity-40"
                  >
                    Read
                  </button>
                </div>
                <p id="wallet-network" className="mt-2 text-xs text-text-3">
                  {pasted ? (
                    <>
                      <b className="font-semibold text-text-2">{NETWORK_LABEL[pasted]} address</b> · we&apos;ll read {READS[pasted]}.
                    </>
                  ) : address.trim() ? (
                    "That doesn't look like a Solana, Ethereum or Bitcoin address yet."
                  ) : (
                    "We read Solana, Ethereum (and Base) and Bitcoin wallets. Read-only: we never ask for keys or signatures."
                  )}
                </p>
              </div>
            )}

            {method === "gemini" && (
              <div className="mt-4">
                <button
                  disabled={busy}
                  onClick={importGemini}
                  className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
                >
                  Import my Gemini balances
                </button>
                <p className="mt-2 text-xs text-text-3">Uses the Gemini account connected to Hedgehog. Balances only.</p>
              </div>
            )}

            {method === "manual" && (
              <div className="mt-4 flex gap-2">
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  aria-label="Coin"
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-accent"
                >
                  {HEDGEABLE_ASSETS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManual()}
                  inputMode="decimal"
                  placeholder={`How much ${asset}?`}
                  aria-label={`Amount of ${asset}`}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
                />
                <button onClick={addManual} className="rounded-xl bg-accent px-5 font-semibold text-accent-ink hover:brightness-110">
                  Add
                </button>
              </div>
            )}

            {busy && <p className="mt-3 text-sm text-text-3">Looking that up…</p>}
            {message && <p className={`mt-3 text-sm ${message.kind === "error" ? "text-bad" : "text-good"}`}>{message.text}</p>}
          </div>
        )}

        {/* What's been added */}
        {holdings.length > 0 && (
          <div className="mt-5">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Your assets</caption>
              <thead className="text-left text-xs text-text-3">
                <tr className="border-b border-border">
                  <th className="pb-2 font-medium">Asset</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Value</th>
                  <th className="hidden pb-2 pl-4 font-medium sm:table-cell">From</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((h, i) => (
                  <tr key={`${h.source}-${h.asset}-${i}`}>
                    <td className="py-2.5 font-semibold">
                      <span className="flex items-center gap-2">
                        <CoinIcon asset={h.asset} size="sm" />
                        {h.asset}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">{qty(h.quantity)}</td>
                    <td className="py-2.5 text-right text-text-2">{prices[h.asset] ? usd(h.quantity * prices[h.asset]) : "—"}</td>
                    <td className="hidden py-2.5 pl-4 text-text-2 sm:table-cell">
                      {SOURCE_LABEL[h.source]}
                      {h.detail && h.source !== "manual" && <span className="block text-xs text-text-3">{h.detail}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => onChange(holdings.filter((_, j) => j !== i))}
                        aria-label={`Remove ${h.asset}`}
                        className="rounded-md px-2 py-0.5 text-text-3 hover:bg-bad-soft hover:text-bad"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {total > 0 && (
                <tfoot>
                  <tr className="border-t border-border">
                    <td className="pt-2.5 font-semibold">Total</td>
                    <td />
                    <td className="pt-2.5 text-right font-bold">{usd(total)}</td>
                    <td className="hidden sm:table-cell" />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          {holdings.length === 0 && <span className="mr-auto text-xs text-text-3">Add at least one asset to see your odds.</span>}
          <button
            onClick={onClose}
            disabled={holdings.length === 0}
            className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
          >
            See my odds →
          </button>
        </div>
      </div>
    </dialog>
  );
}
