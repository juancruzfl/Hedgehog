"use client";

import { useState } from "react";
import { OddsSparkline } from "@/components/charts";
import type { AssetForecast, ForecastHorizon, ForecastPoint } from "@/lib/forecast/forecast";
import { dateTime, pct, qty, shortDate, timeUntil, usd } from "@/lib/format";

export type FPoint = ForecastPoint & {
  history: { ts: number; probBelow: number }[];
  change: { from: number; to: number; sinceTs: number; delta: number } | null;
};
export type FHorizon = Omit<ForecastHorizon, "points"> & { points: FPoint[] };
export type FAsset = Omit<AssetForecast, "horizons"> & { horizons: FHorizon[] };

function Change({ change }: { change: FPoint["change"] }) {
  if (!change || Math.abs(change.delta) < 0.005) return <span className="text-text-3">no change</span>;
  const up = change.delta > 0;
  const hours = (Date.now() - change.sinceTs) / 3600_000;
  return (
    <span className={up ? "text-bad" : "text-good"}>
      {up ? "▲" : "▼"} {Math.abs(change.delta * 100).toFixed(1)} pts{" "}
      <span className="text-text-3">since {hours > 20 ? "yesterday" : dateTime(change.sinceTs)}</span>
    </span>
  );
}

export function ForecastCard({ f, onProtect }: { f: FAsset; onProtect: (horizon: FHorizon) => void }) {
  // Default to the middle horizon (about a week out): the most useful planning window.
  const [hi, setHi] = useState(Math.min(1, f.horizons.length - 1));
  const h = f.horizons[hi];

  if (!h) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-semibold">{f.asset}</h3>
        <p className="mt-1 text-sm text-text-2">No Gemini price markets for {f.asset} right now.</p>
      </article>
    );
  }

  const headline = [...h.points].sort((a, b) => Math.abs(a.drop - 0.1) - Math.abs(b.drop - 0.1))[0];

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-lg font-semibold">{f.asset}</h3>
        <span className="text-sm text-text-2 tabular-nums">
          {qty(f.quantity)} × {usd(f.spot)} = <span className="font-medium text-text">{usd(f.valueUsd)}</span>
        </span>
      </header>

      <p className="mt-3 text-2xl font-semibold leading-snug tabular-nums">
        {pct(headline.probBelow)} chance {f.asset} drops below {usd(headline.strike)}
        <span className="text-text-2"> by {shortDate(h.expiry)}</span>
      </p>
      <p className="mt-1 text-sm text-text-2">
        That&apos;s a {pct(headline.drop)} fall, which would cost you {usd(headline.lossAtStrike)}. <Change change={headline.change} />
      </p>

      <div className="mt-4 flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Time frame">
        {f.horizons.map((x, i) => (
          <button
            key={x.marketId}
            role="tab"
            aria-selected={i === hi}
            onClick={() => setHi(i)}
            className={`rounded-full border px-3 py-1 ${i === hi ? "border-accent font-medium text-accent" : "border-border text-text-2"}`}
          >
            By {shortDate(x.expiry)}
          </button>
        ))}
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Market-implied chance of {f.asset} ending below each price by {shortDate(h.expiry)}</caption>
        <thead className="text-left text-xs text-text-3">
          <tr>
            <th className="pb-2 font-normal">Ends below</th>
            <th className="pb-2 font-normal">Chance</th>
            <th className="hidden pb-2 font-normal sm:table-cell">Odds over time</th>
            <th className="pb-2 text-right font-normal">Would cost you</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {h.points.map((p) => (
            <tr key={p.symbol}>
              <td className="py-2 tabular-nums">
                {usd(p.strike)} <span className="text-text-3">(−{pct(p.drop)})</span>
              </td>
              <td className="py-2 font-medium tabular-nums">{pct(p.probBelow)}</td>
              <td className="hidden py-1 sm:table-cell">
                {p.history.length >= 3 ? <OddsSparkline data={p.history} /> : <span className="text-xs text-text-3">collecting…</span>}
              </td>
              <td className="py-2 text-right tabular-nums">{usd(p.lossAtStrike)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => onProtect(h)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          Reduce this risk
        </button>
        <span className="text-xs text-text-3">
          Odds from Gemini prediction markets · settles {timeUntil(h.expiry)}
        </span>
      </div>
    </article>
  );
}
