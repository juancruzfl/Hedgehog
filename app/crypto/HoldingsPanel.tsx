"use client";

import { useState } from "react";
import { StepHeading } from "@/components/ui";
import { qty, usd } from "@/lib/format";
import { HEDGEABLE_ASSETS, isHedgeable, type Holding } from "@/lib/holdings";

declare global {
  interface Window {
    phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString(): string } }> } };
  }
}

type Import = null | "solana" | "gemini";

const SOURCE_LABEL: Record<Holding["source"], string> = { solana: "From your Solana wallet", gemini: "From Gemini", manual: "Added by you" };

export function HoldingsPanel({
  holdings,
  onChange,
  prices,
  initialAsset = null,
}: {
  holdings: Holding[];
  onChange: (h: Holding[]) => void;
  prices: Record<string, number>;
  initialAsset?: string | null;
}) {
  const fromCard = initialAsset && isHedgeable(initialAsset) ? initialAsset : null;
  const [asset, setAsset] = useState<string>(fromCard ?? "SOL");
  const [amount, setAmount] = useState("");
  const [importing, setImporting] = useState<Import>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  /** Replace everything from one source (re-importing shouldn't double count). */
  const replaceSource = (source: Holding["source"], next: Holding[]) => onChange([...holdings.filter((h) => h.source !== source), ...next]);

  function add() {
    const n = Number(amount);
    if (!(n > 0)) return setMessage({ kind: "error", text: "Enter how much you hold, e.g. 20." });
    // Typing the same coin again updates it rather than adding a duplicate line.
    onChange([...holdings.filter((h) => !(h.source === "manual" && h.asset === asset)), { asset, quantity: n, source: "manual" }]);
    setAmount("");
    setMessage(null);
  }

  async function lookupSolana(addr: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/holdings/solana?address=${encodeURIComponent(addr)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const found = (body.holdings as Holding[]).filter((h) => isHedgeable(h.asset));
      replaceSource("solana", found);
      setMessage(found.length ? { kind: "info", text: `Added ${found.length} from your wallet.` } : { kind: "info", text: "We didn't find SOL, BTC or ETH in that wallet." });
      if (found.length) setImporting(null);
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function connectPhantom() {
    const phantom = window.phantom?.solana;
    if (!phantom) return setMessage({ kind: "error", text: "Phantom isn't installed in this browser. Paste your address instead." });
    try {
      const { publicKey } = await phantom.connect();
      setAddress(publicKey.toString());
      await lookupSolana(publicKey.toString());
    } catch {
      setMessage({ kind: "error", text: "Phantom connection was cancelled." });
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
      setMessage({ kind: "info", text: `Added ${body.holdings.length} from Gemini${body.env === "sandbox" ? " (test account)" : ""}.` });
      setImporting(null);
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const total = holdings.reduce((s, h) => s + (prices[h.asset] ?? 0) * h.quantity, 0);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <StepHeading n={1} title="What do you hold?" sub="Read-only. Nothing to sign, and nothing leaves your wallet." />

      {/* Quick add */}
      <div className="mt-5">
        <div role="radiogroup" aria-label="Coin" className="grid grid-cols-4 gap-2">
          {HEDGEABLE_ASSETS.map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={asset === a}
              onClick={() => setAsset(a)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                asset === a ? "border-accent bg-accent-soft text-text" : "border-border bg-background text-text-2 hover:border-text-3"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            inputMode="decimal"
            placeholder={`How much ${asset}? e.g. 20`}
            aria-label={`Amount of ${asset}`}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-3 text-[15px] outline-none focus:border-accent"
          />
          <button onClick={add} className="rounded-xl bg-accent px-5 font-semibold text-accent-ink hover:brightness-110">
            Add
          </button>
        </div>
      </div>

      {/* Imports */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-3">Or import from</span>
        <button
          onClick={() => setImporting(importing === "solana" ? null : "solana")}
          aria-expanded={importing === "solana"}
          className={`rounded-full border px-3 py-1 ${importing === "solana" ? "border-accent text-accent" : "border-border text-text-2 hover:text-text"}`}
        >
          Solana wallet
        </button>
        <button
          onClick={() => setImporting(importing === "gemini" ? null : "gemini")}
          aria-expanded={importing === "gemini"}
          className={`rounded-full border px-3 py-1 ${importing === "gemini" ? "border-accent text-accent" : "border-border text-text-2 hover:text-text"}`}
        >
          Gemini account
        </button>
      </div>

      {importing === "solana" && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste your Solana address"
              aria-label="Solana address"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
            <button disabled={busy || !address.trim()} onClick={() => lookupSolana(address.trim())} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-40">
              Read wallet
            </button>
            <button disabled={busy} onClick={connectPhantom} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm">
              Use Phantom
            </button>
          </div>
          <p className="mt-2 text-xs text-text-3">We only read balances: SOL, plus BTC and ETH tokens on Solana.</p>
        </div>
      )}
      {importing === "gemini" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <span className="text-text-2">Uses the Gemini account connected to Hedgehog.</span>
          <button disabled={busy} onClick={importGemini} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-40">
            Import balances
          </button>
        </div>
      )}

      {busy && <p className="mt-3 text-sm text-text-3">Looking that up…</p>}
      {message && <p className={`mt-3 text-sm ${message.kind === "error" ? "text-bad" : "text-text-2"}`}>{message.text}</p>}

      {/* What you hold */}
      {holdings.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <ul className="space-y-2">
            {holdings.map((h, i) => (
              <li key={`${h.source}-${h.asset}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-bold">{h.asset}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">
                    {qty(h.quantity)} {h.asset}
                    {prices[h.asset] ? <span className="ml-2 font-normal text-text-2">{usd(h.quantity * prices[h.asset])}</span> : null}
                  </p>
                  <p className="text-xs text-text-3">{h.detail?.includes("wallet") ? h.detail.replace(" in Solana wallet", " · Solana wallet") : SOURCE_LABEL[h.source]}</p>
                </div>
                <button onClick={() => onChange(holdings.filter((_, j) => j !== i))} className="rounded-lg px-2 py-1 text-sm text-text-3 hover:bg-surface-2 hover:text-bad" aria-label={`Remove ${h.asset}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {total > 0 && (
            <p className="mt-3 flex justify-between text-sm">
              <span className="text-text-2">Total</span>
              <span className="font-bold tabular-nums">{usd(total)}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
