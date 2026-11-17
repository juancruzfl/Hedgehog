"use client";

import { useEffect, useState } from "react";
import { ApprovePanel } from "@/components/ApprovePanel";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import { Segmented, Stat, StepHeading } from "@/components/ui";
import type { LadderResult } from "@/lib/engine/sizer";
import { pct, qty, shortDate, timeUntil, usd } from "@/lib/format";
import type { RiskProfile } from "@/lib/types";

interface Preview {
  spot: number;
  market: { id: string; title: string; expiry: string };
  expiries: { id: string; title: string; expiry: string }[];
  profile: RiskProfile;
  proposal: LadderResult;
  curve: CurvePoint[];
}

type Level = "light" | "balanced" | "strong" | "custom";
const LEVELS: Record<Exclude<Level, "custom">, { start: number; floor: number; label: string }> = {
  light: { start: 0.1, floor: 0.25, label: "Light" },
  balanced: { start: 0.05, floor: 0.3, label: "Balanced" },
  strong: { start: 0.03, floor: 0.4, label: "Strong" },
};

const signed = (n: number) => (n > 0.5 ? `+${usd(n)}` : n < -0.5 ? `−${usd(Math.abs(n))}` : usd(0));

/** Rows for "What happens if…": price up 10%, down 10/20/30%, read off the payoff curve. */
function scenarios(curve: CurvePoint[], spot: number) {
  return [0.1, -0.1, -0.2, -0.3].map((move) => {
    const target = spot * (1 + move);
    const p = curve.reduce((best, c) => (Math.abs(c.price - target) < Math.abs(best.price - target) ? c : best), curve[0]);
    return { move, price: target, without: p.unhedged, with: p.hedged };
  });
}

export function HedgeBuilder({ asset, quantity, marketId, onClose }: { asset: string; quantity: number; marketId: string; onClose: () => void }) {
  const [market, setMarket] = useState(marketId);
  const [level, setLevel] = useState<Level>("balanced");
  const [startDrop, setStartDrop] = useState(LEVELS.balanced.start);
  const [floorDrop, setFloorDrop] = useState(LEVELS.balanced.floor);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickLevel(l: Level) {
    setLevel(l);
    if (l !== "custom") {
      setStartDrop(LEVELS[l].start);
      setFloorDrop(LEVELS[l].floor);
    }
  }

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

  const p = preview?.proposal;
  const top = p?.legs[0]?.contract.strike?.value ?? null;
  const value = preview ? quantity * preview.spot : 0;
  const expiries = [...(preview?.expiries ?? [])].sort((a, b) => a.expiry.localeCompare(b.expiry));

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <StepHeading n={3} title={`Soften a drop in your ${asset}`} sub="Choose how big a cushion you want. You'll see the full cost before anything happens." />
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Choices */}
      <div className="mt-6 space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold">Protect until</p>
          {expiries.length > 0 ? (
            <Segmented
              label="Protect until"
              value={market}
              onChange={setMarket}
              options={expiries.map((x) => ({ value: x.id, label: shortDate(x.expiry), sub: timeUntil(x.expiry) }))}
            />
          ) : (
            <p className="text-sm text-text-3">Loading dates…</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">How big a cushion</p>
          <Segmented
            label="How big a cushion"
            value={level}
            onChange={pickLevel}
            options={[
              ...(["light", "balanced", "strong"] as const).map((l) => ({
                value: l,
                label: LEVELS[l].label,
                sub: `Pays from −${Math.round(LEVELS[l].start * 100)}% to −${Math.round(LEVELS[l].floor * 100)}%`,
              })),
              { value: "custom" as const, label: "Custom", sub: "Set your own range" },
            ]}
          />
          {level === "custom" && (
            <div className="mt-3 grid gap-4 rounded-xl bg-surface-2 p-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-text-2">
                  Start paying after a drop of <b className="text-text">{Math.round(startDrop * 100)}%</b>
                </span>
                <input type="range" min={0.02} max={0.2} step={0.01} value={startDrop} onChange={(e) => setStartDrop(Math.min(Number(e.target.value), floorDrop - 0.05))} className="mt-2 w-full accent-[var(--accent)]" />
              </label>
              <label className="text-sm">
                <span className="text-text-2">
                  Keep paying down to <b className="text-text">−{Math.round(floorDrop * 100)}%</b>
                </span>
                <input type="range" min={0.1} max={0.5} step={0.01} value={floorDrop} onChange={(e) => setFloorDrop(Math.max(Number(e.target.value), startDrop + 0.05))} className="mt-2 w-full accent-[var(--accent)]" />
              </label>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-bad">{error}</p>}
      {!preview && !error && <p className="mt-5 text-sm text-text-3">Finding prices on Gemini…</p>}

      {preview && p && (
        <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
          {p.legs.length === 0 ? (
            <p className="rounded-xl bg-warn-bg p-4 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try another date or a different level.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="You pay now" value={usd(p.totalCost)} note={`${((p.totalCost / value) * 100).toFixed(1)}% of your ${asset}`} />
                <Stat label="Starts paying below" value={usd(top!)} note={`${pct(1 - top! / preview.spot)} under today`} />
                <Stat label="Most you get back" value={usd(p.maxPayout)} note={`if ${asset} ends near ${usd(p.floorPrice)}`} />
              </div>

              {/* What happens if… */}
              <div className="mt-6">
                <p className="text-sm font-semibold">What happens if {asset} ends at… on {shortDate(preview.market.expiry)}</p>
                <div className="mt-2 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="bg-surface-2 text-left text-xs text-text-2">
                      <tr>
                        <th className="px-3 py-2 font-medium">{asset} price</th>
                        <th className="px-3 py-2 text-right font-medium">Without Hedgehog</th>
                        <th className="px-3 py-2 text-right font-medium">With Hedgehog</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {scenarios(preview.curve, preview.spot).map((s) => (
                        <tr key={s.move}>
                          <td className="px-3 py-2.5">
                            {usd(s.price)} <span className="text-text-3">({s.move > 0 ? "+" : "−"}{Math.abs(s.move * 100)}%)</span>
                          </td>
                          <td className="px-3 py-2.5 text-right">{signed(s.without)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${s.with > s.without + 0.5 ? "text-good" : ""}`}>{signed(s.with)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-text-3">
                  Your gain or loss on {qty(quantity)} {asset}, including the {usd(p.totalCost)} you pay. If {asset} goes up, the hedge costs you that {usd(p.totalCost)}.
                </p>
              </div>

              <details className="mt-4 rounded-xl border border-border px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">See the full picture</summary>
                <div className="mt-3">
                  <PayoffChart data={preview.curve} spot={preview.spot} asset={asset} />
                </div>
              </details>

              <div className="mt-3 rounded-xl border border-border px-4 py-3 text-sm">
                <p className="font-medium">What this doesn&apos;t cover</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-2">
                  <li>The first part of a drop, from {usd(preview.spot)} down to {usd(top!)}.</li>
                  <li>Losses below about {usd(p.floorPrice)}: the payout stops growing there.</li>
                  <li>Prices between levels: the payout grows in steps, not smoothly.</li>
                  <li>Gemini trading fees.</li>
                </ul>
              </div>

              <details className="mt-3 rounded-xl border border-border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">Exact orders on Gemini ({p.legs.length})</summary>
                <table className="mt-2 w-full tabular-nums">
                  <thead className="text-left text-xs text-text-3">
                    <tr>
                      <th className="py-1 font-normal">Pays $1 if {asset} is below</th>
                      <th className="text-right font-normal">Contracts</th>
                      <th className="text-right font-normal">Price</th>
                      <th className="text-right font-normal">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {p.legs.map((l) => (
                      <tr key={l.contract.symbol}>
                        <td className="py-1.5">{usd(l.contract.strike!.value!)}</td>
                        <td className="text-right">{qty(l.quantity)}</td>
                        <td className="text-right">{usd(l.limitPrice)}</td>
                        <td className="text-right">{usd(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-text-3">Each is a &ldquo;NO&rdquo; on Gemini&apos;s &ldquo;{asset} at $X or above&rdquo; market, which pays $1 if the price ends below $X.</p>
              </details>

              <ApprovePanel
                legs={p.legs.map((l) => ({ marketId: l.contract.marketId, symbol: l.contract.symbol, outcome: l.outcome, quantity: l.quantity, limitPrice: l.limitPrice }))}
                totalCost={p.totalCost}
                title={`Hedge ${qty(quantity)} ${asset} through ${shortDate(preview.market.expiry)}`}
                segment="crypto"
                profile={preview.profile}
                successTitle={`Your ${asset} hedge is placed`}
                onDone={onClose}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
