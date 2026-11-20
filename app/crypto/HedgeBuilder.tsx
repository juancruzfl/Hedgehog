"use client";

import { useEffect, useState } from "react";
import { ApprovePanel } from "@/components/ApprovePanel";
import { CoinIcon } from "@/components/CoinIcon";
import { Sheet } from "@/components/Sheet";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import { Stepper, WhatIf } from "@/components/HedgeControls";
import { Segmented } from "@/components/ui";
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
    <Sheet
      onClose={onClose}
      icon={<CoinIcon asset={asset} />}
      title={`Soften a drop in your ${asset}`}
      sub="Choose how big a cushion you want. You'll see the full cost before anything happens."
    >

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
              <Stepper
                label="Start paying after a drop of"
                value={Math.round(startDrop * 100)}
                min={2}
                max={Math.min(20, Math.round(floorDrop * 100) - 5)}
                onChange={(v) => setStartDrop(v / 100)}
                suffix="%"
              />
              <Stepper
                label="Keep paying down to a drop of"
                value={Math.round(floorDrop * 100)}
                min={Math.max(10, Math.round(startDrop * 100) + 5)}
                max={50}
                onChange={(v) => setFloorDrop(v / 100)}
                suffix="%"
              />
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
              {/* The whole deal in one sentence */}
              <p className="text-xl leading-snug sm:text-2xl">
                <b className="font-semibold">Pay {usd(p.totalCost)} now.</b> If {asset} falls below <b className="font-semibold">{usd(top!)}</b> by{" "}
                <b className="font-semibold">{shortDate(preview.market.expiry)}</b>, you get back up to{" "}
                <b className="font-semibold text-good">{usd(p.maxPayout)}</b>.
              </p>
              <p className="mt-1 text-sm text-text-3">
                That&apos;s about {((p.totalCost / value) * 100).toFixed(1)}% of the {usd(value)} your {asset} is worth today.
              </p>

              <WhatIf curve={preview.curve} spot={preview.spot} asset={asset} payFrom={top!} payTo={p.floorPrice} date={shortDate(preview.market.expiry)} />

              {/* The limits, said once */}
              <p className="mt-3 text-sm text-text-2">
                Pays for drops between {usd(top!)} and {usd(p.floorPrice)}. It won&apos;t cover the first {pct(1 - top! / preview.spot)} of a drop, anything
                below {usd(p.floorPrice)}, or Gemini&apos;s trading fees.
              </p>

              {/* Everything a trader might want, out of everyone else's way */}
              <details className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">For traders: payoff chart and exact orders</summary>
                <div className="mt-3">
                  <PayoffChart data={preview.curve} spot={preview.spot} asset={asset} />
                </div>
                <table className="mt-4 w-full tabular-nums">
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
                <p className="mt-2 text-xs text-text-3">
                  Each is a &ldquo;NO&rdquo; on Gemini&apos;s &ldquo;{asset} at $X or above&rdquo; market, which pays $1 if the price ends below $X. The payout grows in
                  steps between these levels.
                </p>
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
    </Sheet>
  );
}
