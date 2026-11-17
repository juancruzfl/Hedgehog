"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import type { LadderResult } from "@/lib/engine/sizer";
import { qty, shortDate, usd } from "@/lib/format";
import type { RiskProfile } from "@/lib/types";

interface Preview {
  spot: number;
  market: { id: string; title: string; expiry: string };
  expiries: { id: string; title: string; expiry: string }[];
  profile: RiskProfile;
  proposal: LadderResult;
  curve: CurvePoint[];
}

interface ExecResult {
  ok: boolean;
  mode?: "paper" | "live";
  problems?: string[];
  error?: string;
  results?: { symbol: string; status: string; fillPrice?: number; error?: string }[];
}

export function HedgeBuilder({ asset, quantity, marketId, onClose }: { asset: string; quantity: number; marketId: string; onClose: () => void }) {
  const [market, setMarket] = useState(marketId);
  const [startDrop, setStartDrop] = useState(0.05);
  const [floorDrop, setFloorDrop] = useState(0.3);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ asset, quantity: String(quantity), market, startDrop: String(startDrop), floorDrop: String(floorDrop) });
        const res = await fetch(`/api/hedge/crypto?${qs}`, { signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        setPreview(body);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [asset, quantity, market, startDrop, floorDrop]);

  async function approve() {
    if (!preview) return;
    setResult(null);
    const p = preview.proposal;
    const res = await fetch("/api/hedge/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Protect ${qty(quantity)} ${asset} through ${shortDate(preview.market.expiry)}`,
        segment: "crypto",
        profile: preview.profile,
        legs: p.legs.map((l) => ({
          marketId: l.contract.marketId,
          symbol: l.contract.symbol,
          outcome: l.outcome,
          quantity: l.quantity,
          limitPrice: l.limitPrice,
        })),
      }),
    });
    const body = await res.json();
    setResult(body.ok ? body : { ok: false, problems: body.problems, error: body.error });
    setConfirming(false);
  }

  const p = preview?.proposal;
  const lowestStrike = p?.legs.length ? p.legs[p.legs.length - 1].contract.strike?.value ?? null : null;
  const topStrike = p?.legs[0]?.contract.strike?.value ?? null;

  if (result?.ok) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Your {asset} is hedged ✓</h2>
        <p className="mt-1 text-sm text-text-2">
          {result.mode === "paper"
            ? "Recorded as a paper trade at live Gemini prices. No real money moved."
            : "Orders sent to Gemini. Fills will show in My hedges."}
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/positions" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">See my hedges</Link>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Reduce your {asset} risk</h2>
          <p className="mt-1 text-sm text-text-2">You choose how much to protect. Hedgehog finds the prices on Gemini.</p>
        </div>
        <button onClick={onClose} className="text-sm text-text-3 hover:text-text" aria-label="Close">✕</button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-text-2">Protect until</span>
          <select value={market} onChange={(e) => setMarket(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2">
            {(preview?.expiries ?? [{ id: marketId, title: "", expiry: "" }]).map((x) => (
              <option key={x.id} value={x.id}>{x.expiry ? shortDate(x.expiry) : "…"}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-text-2">Start after a drop of <b className="text-text">{Math.round(startDrop * 100)}%</b></span>
          <input type="range" min={0.02} max={0.2} step={0.01} value={startDrop} onChange={(e) => setStartDrop(Math.min(Number(e.target.value), floorDrop - 0.05))} className="mt-3 w-full accent-[var(--accent)]" />
        </label>
        <label className="text-sm">
          <span className="text-text-2">Protect down to <b className="text-text">−{Math.round(floorDrop * 100)}%</b></span>
          <input type="range" min={0.1} max={0.5} step={0.01} value={floorDrop} onChange={(e) => setFloorDrop(Math.max(Number(e.target.value), startDrop + 0.05))} className="mt-3 w-full accent-[var(--accent)]" />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      {!preview && !error && <p className="mt-4 text-sm text-text-3">Finding prices…</p>}

      {preview && p && (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          {p.legs.length === 0 ? (
            <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try a different date or range.</p>
          ) : (
            <>
              <p className="mt-6 text-xl font-semibold leading-snug tabular-nums">
                Pay {usd(p.totalCost)} now. If {asset} ends below {usd(topStrike!)} on {shortDate(preview.market.expiry)}, you get back up to {usd(p.maxPayout)}.
              </p>
              <p className="mt-1 text-sm text-text-2">
                Costs {((p.totalCost / (quantity * preview.spot)) * 100).toFixed(1)}% of your {usd(quantity * preview.spot)} in {asset}. If {asset} doesn&apos;t fall that far, the {usd(p.totalCost)} is spent.
              </p>

              <div className="mt-5">
                <PayoffChart data={preview.curve} spot={preview.spot} asset={asset} />
              </div>

              <div className="mt-4 rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">What this doesn&apos;t cover</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-2">
                  <li>The first drop, from {usd(preview.spot)} to {usd(topStrike!)}.</li>
                  {lowestStrike !== null && <li>Losses below about {usd(p.floorPrice)}: the payout stops growing there.</li>}
                  <li>Prices in between strikes, where the payout moves in steps.</li>
                  {p.warnings.filter((w) => w.includes("fees") || w.includes("narrowed")).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-text-2">Exact orders on Gemini ({p.legs.length})</summary>
                <table className="mt-2 w-full">
                  <thead className="text-left text-xs text-text-3">
                    <tr><th className="py-1 font-normal">Contract</th><th className="font-normal">Buy</th><th className="text-right font-normal">Contracts</th><th className="text-right font-normal">Price</th><th className="text-right font-normal">Cost</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {p.legs.map((l) => (
                      <tr key={l.contract.symbol}>
                        <td className="py-1.5">{l.contract.marketTitle}: {l.contract.label}</td>
                        <td>{l.outcome.toUpperCase()}</td>
                        <td className="text-right">{qty(l.quantity)}</td>
                        <td className="text-right">{usd(l.limitPrice)}</td>
                        <td className="text-right">{usd(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-text-3">Each contract pays $1 if {asset} ends below its price. Buying “NO” on “$X or above” pays when the price falls under $X.</p>
              </details>

              {result && !result.ok && (
                <div className="mt-4 rounded-lg bg-warn-bg p-3 text-sm">
                  <p className="font-medium">Nothing was placed.</p>
                  <ul className="mt-1 list-disc pl-5">{(result.problems ?? [result.error]).map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}

              {!confirming ? (
                <button onClick={() => { setConfirming(true); setUnderstood(false); }} className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-ink sm:w-auto">
                  Review & approve
                </button>
              ) : (
                <div className="mt-5 rounded-xl border border-accent p-4">
                  <p className="font-medium">Approve {p.legs.length} order{p.legs.length > 1 ? "s" : ""} for up to {usd(p.totalCost)}?</p>
                  <label className="mt-3 flex items-start gap-2 text-sm text-text-2">
                    <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
                    I understand this reduces but does not remove my losses, and I can lose the {usd(p.totalCost)} I pay.
                  </label>
                  <div className="mt-4 flex gap-3">
                    <button disabled={!understood} onClick={approve} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">Approve</button>
                    <button onClick={() => setConfirming(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
