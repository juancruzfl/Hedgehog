"use client";

import { useState } from "react";
import { HEDGEABLE_ASSETS, isHedgeable, type Holding } from "@/lib/holdings";
import { qty } from "@/lib/format";

type Tab = "solana" | "gemini" | "manual";

declare global {
  interface Window {
    phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString(): string } }> } };
  }
}

const SOURCE_LABEL: Record<Holding["source"], string> = { solana: "Solana wallet", gemini: "Gemini", manual: "Entered by you" };

export function HoldingsPanel({
  holdings,
  onChange,
  initialAsset = null,
}: {
  holdings: Holding[];
  onChange: (h: Holding[]) => void;
  initialAsset?: string | null;
}) {
  // Arriving from a board card ("Protect my SOL") opens manual entry with that coin picked.
  const fromCard = initialAsset && isHedgeable(initialAsset) ? initialAsset : null;
  const [tab, setTab] = useState<Tab>(fromCard ? "manual" : "solana");
  const [address, setAddress] = useState("");
  const [asset, setAsset] = useState<string>(fromCard ?? "SOL");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  /** Replace everything from one source (re-importing shouldn't double count). */
  const replaceSource = (source: Holding["source"], next: Holding[]) =>
    onChange([...holdings.filter((h) => h.source !== source), ...next]);

  async function lookupSolana(addr: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/holdings/solana?address=${encodeURIComponent(addr)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const found = (body.holdings as Holding[]).filter((h) => isHedgeable(h.asset));
      replaceSource("solana", found);
      setMessage(
        found.length
          ? { kind: "info", text: `Found ${found.length} holding${found.length > 1 ? "s" : ""} Hedgehog can protect.` }
          : { kind: "info", text: "No SOL, BTC or ETH found in that wallet." },
      );
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function connectPhantom() {
    const phantom = window.phantom?.solana;
    if (!phantom) {
      setMessage({ kind: "error", text: "Phantom isn't installed in this browser. Paste your address instead." });
      return;
    }
    try {
      const { publicKey } = await phantom.connect();
      const addr = publicKey.toString();
      setAddress(addr);
      await lookupSolana(addr);
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
      setMessage({
        kind: "info",
        text: `Imported ${body.holdings.length} balance${body.holdings.length === 1 ? "" : "s"}${body.env === "sandbox" ? " (Gemini sandbox account)" : ""}.`,
      });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function addManual() {
    const n = Number(amount);
    if (!(n > 0)) return setMessage({ kind: "error", text: "Enter an amount above zero." });
    onChange([...holdings, { asset, quantity: n, source: "manual", detail: `${asset} entered by you` }]);
    setAmount("");
    setMessage(null);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "solana", label: "Solana wallet" },
    { id: "gemini", label: "Gemini account" },
    { id: "manual", label: "Type it in" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">What do you hold?</h2>
      <p className="mt-1 text-sm text-text-2">Read-only. Hedgehog never asks you to sign anything or move your crypto.</p>

      <div role="tablist" className="mt-4 flex gap-1 rounded-lg bg-background p-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setMessage(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 ${tab === t.id ? "bg-surface font-medium ring-1 ring-border" : "text-text-2"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "solana" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste a Solana address"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <button disabled={busy || !address.trim()} onClick={() => lookupSolana(address.trim())} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
              Look up
            </button>
            <button disabled={busy} onClick={connectPhantom} className="rounded-lg border border-border px-4 py-2 text-sm">
              Use Phantom
            </button>
          </div>
        )}
        {tab === "gemini" && (
          <button disabled={busy} onClick={importGemini} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
            Import my Gemini balances
          </button>
        )}
        {tab === "manual" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {HEDGEABLE_ASSETS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              inputMode="decimal"
              placeholder="Amount, e.g. 20"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button onClick={addManual} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
              Add
            </button>
          </div>
        )}
        {busy && <p className="mt-2 text-sm text-text-3">Looking that up…</p>}
        {message && <p className={`mt-2 text-sm ${message.kind === "error" ? "text-bad" : "text-text-2"}`}>{message.text}</p>}
      </div>

      {holdings.length > 0 && (
        <ul className="mt-5 divide-y divide-border border-t border-border text-sm">
          {holdings.map((h, i) => (
            <li key={`${h.source}-${h.asset}-${i}`} className="flex items-center gap-3 py-2">
              <span className="w-12 font-medium">{h.asset}</span>
              <span className="tabular-nums">{qty(h.quantity)}</span>
              <span className="text-text-3">{h.detail ?? SOURCE_LABEL[h.source]}</span>
              <button onClick={() => onChange(holdings.filter((_, j) => j !== i))} className="ml-auto text-text-3 hover:text-bad" aria-label={`Remove ${h.asset}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
