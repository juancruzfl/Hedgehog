"use client";

import { useEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { OddsHistoryChart } from "@/components/charts";
import { Segmented, oddsInWords } from "@/components/ui";
import type { AssetForecast, ForecastHorizon, ForecastPoint } from "@/lib/forecast/forecast";
import { dateTime, pct, qty, shortDate, timeUntil, usd } from "@/lib/format";

export type FPoint = ForecastPoint & {
  history: { ts: number; probBelow: number }[];
  change: { from: number; to: number; sinceTs: number; delta: number } | null;
};
export type FHorizon = Omit<ForecastHorizon, "points"> & { points: FPoint[] };
export type FAsset = Omit<AssetForecast, "horizons"> & { horizons: FHorizon[] };

function Change({ change }: { change: FPoint["change"] }) {
  if (!change || Math.abs(change.delta) < 0.005) return null;
  const up = change.delta > 0;
  const hours = (Date.now() - change.sinceTs) / 3600_000;
  return (
    <span className={`text-sm ${up ? "text-bad" : "text-good"}`}>
      {up ? "▲ Up" : "▼ Down"} {Math.abs(change.delta * 100).toFixed(1)} pts{" "}
      <span className="text-text-3">since {hours > 20 ? "yesterday" : dateTime(change.sinceTs)}</span>
    </span>
  );
}

/** "Today" / "Nov 20" style label plus how far away it is. */
function horizonOption(h: FHorizon, j: number) {
  const until = timeUntil(h.expiry);
  return { value: j, label: `By ${shortDate(h.expiry)}`, sub: until.replace(/^in /, "in ") };
}

export function ForecastCard({
  f,
  asOf,
  onProtect,
  showHolding = true,
}: {
  f: FAsset;
  asOf: number;
  onProtect: (horizon: FHorizon) => void;
  /** Off when the page header already names the coin and amount. */
  showHolding?: boolean;
}) {
  // Default to the middle horizon (about a week out): the most useful planning window.
  const [hi, setHi] = useState(Math.min(1, f.horizons.length - 1));
  // Each card flips on its own; flipping one never changes another.
  const [flipped, setFlipped] = useState(false);
  const flipRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // Move keyboard focus to the side that's now showing (not on first render).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    (flipped ? backRef : flipRef).current?.focus({ preventScroll: true });
  }, [flipped]);
  const h = f.horizons[hi];

  if (!h) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-5">
        <p className="font-semibold">{f.asset}</p>
        <p className="mt-1 text-sm text-text-2">Gemini doesn&apos;t list price markets for {f.asset} right now.</p>
      </article>
    );
  }

  // Headline: the drop closest to 10%, the most intuitive "bad week".
  const headline = [...h.points].sort((a, b) => Math.abs(a.drop - 0.1) - Math.abs(b.drop - 0.1))[0];
  const ladder = [...h.points].sort((a, b) => a.drop - b.drop);

  const hasHistory = h.points.some((p) => p.history.length >= 3);
  const face = "rounded-2xl border border-border bg-surface p-5 sm:p-6 [backface-visibility:hidden]";

  return (
    // A card with two faces: the odds (front) and how they've moved (back). The back
    // is laid over the front, so the card keeps exactly the same size when flipped.
    // It fills whatever height the stage gives it, so every coin's card is the same size.
    <div className="flex flex-col [perspective:1600px]">
      <div
        className="relative flex flex-1 flex-col transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        <article className={`${face} flex flex-1 flex-col`} inert={flipped} aria-hidden={flipped}>
          {showHolding && (
            <header className="mb-4 flex flex-wrap items-center gap-3">
              <CoinIcon asset={f.asset} />
              <div className="mr-auto">
                <p className="font-semibold">{f.asset}</p>
                <p className="text-sm text-text-2 tabular-nums">
                  {qty(f.quantity)} {f.asset} · {usd(f.valueUsd)} at {usd(f.spot)} each
                </p>
              </div>
            </header>
          )}

          <div>
            <Segmented label="Time frame" options={f.horizons.map(horizonOption)} value={hi} onChange={setHi} />
          </div>

          {/* The headline question */}
          <div className="mt-5 rounded-xl bg-surface-2 p-4 sm:p-5">
            <h3 className="text-lg font-bold leading-snug sm:text-xl">
              Will {f.asset} drop below {usd(headline.strike)} by {shortDate(h.expiry)}?
            </h3>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-extrabold tabular-nums tracking-tight text-accent">{pct(headline.probBelow)}</span>
              <span className="text-text-2">chance · {oddsInWords(headline.probBelow)}</span>
              <Change change={headline.change} />
            </div>
            <p className="mt-2 text-[15px]">
              If it does, you&apos;d be down about <b className="tabular-nums">{usd(headline.lossAtStrike)}</b> (a {pct(headline.drop)} fall).
            </p>
          </div>

          {/* Ladder of drops */}
          {/* Always room for three price levels, so switching dates never resizes the card */}
          <div className="mt-5">
              <p className="text-sm font-semibold">Smaller and bigger drops</p>
              <ul className="mt-2 min-h-[5.25rem] space-y-2.5">
                {ladder.map((p) => (
                  <li key={p.symbol} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3rem_5rem]">
                    <span className="tabular-nums">
                      −{pct(p.drop)} <span className="text-text-3">· {usd(p.strike)}</span>
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, p.probBelow * 100)}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{pct(p.probBelow)}</span>
                    <span className="hidden text-right text-text-2 tabular-nums sm:block">−{usd(p.lossAtStrike)}</span>
                  </li>
                ))}
                {ladder.length < 2 && <li className="text-sm text-text-3">Gemini lists only this price level for this date.</li>}
              </ul>
          </div>

          <div className="mt-4 mb-5">
            {hasHistory ? (
              <button ref={flipRef} onClick={() => setFlipped(true)} className="text-sm font-medium text-accent hover:underline">
                See how these odds have moved ↻
              </button>
            ) : (
              <p className="text-sm text-text-3">Odds history shows up after a few snapshots.</p>
            )}
          </div>

          {/* Button row sits at the bottom, whatever the card's height */}
          <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button onClick={() => onProtect(h)} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
              Soften a drop in my {f.asset} →
            </button>
            <span className="text-xs text-text-3">Odds from Gemini prediction markets</span>
          </div>
        </article>

        {hasHistory && (
          <article
            className={`${face} absolute inset-0 flex flex-col overflow-y-auto`}
            style={{ transform: "rotateY(180deg)" }}
            inert={!flipped}
            aria-hidden={!flipped}
            aria-label={`How the odds for ${f.asset} have moved`}
          >
            <header className="flex items-center gap-3">
              <CoinIcon asset={f.asset} />
              <div className="mr-auto">
                <p className="font-semibold">{f.asset} · how the odds have moved</p>
                <p className="text-sm text-text-2">Chance it ends below each price by {shortDate(h.expiry)}</p>
              </div>
            </header>
            <div className="mt-4 min-h-0 flex-1">
              <OddsHistoryChart
                title=""
                series={h.points.map((p) => ({
                  key: p.symbol,
                  label: `Below ${usd(p.strike)}`,
                  data: [...p.history, { ts: asOf, probBelow: p.probBelow }],
                }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                ref={backRef}
                onClick={() => setFlipped(false)}
                className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-text-3"
              >
                ← Back to the odds
              </button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
