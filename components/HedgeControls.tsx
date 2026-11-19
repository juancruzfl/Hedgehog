"use client";

import { useState } from "react";
import type { CurvePoint } from "@/components/charts";
import { usd } from "@/lib/format";

// Controls shared by the crypto and business hedge popups: the "what if" price slider
// and the bounded number box with − / + arrows.

/** Whole dollars: in a "what if" the cents are noise. */
const signed = (n: number) => (n > 0.5 ? `+${usd(n, 0)}` : n < -0.5 ? `−${usd(Math.abs(n), 0)}` : usd(0, 0));
/** Green for a gain, red for a loss, plain for about zero: the color always agrees with the sign. */
const tone = (n: number) => (n > 0.5 ? "text-good" : n < -0.5 ? "text-bad" : "");

/**
 * "What if" slider: drag the price it ends at and see the result with and without the
 * hedge. A teal band on the track marks the range where the hedge pays out.
 */
export function WhatIf({
  curve,
  spot,
  asset,
  payFrom,
  payTo,
  date,
  rising = false,
}: {
  curve: CurvePoint[];
  spot: number;
  asset: string;
  payFrom: number;
  payTo: number;
  date: string;
  /** True when the user loses as the price rises (fuel, metals bought): start the slider above today. */
  rising?: boolean;
}) {
  // Start at a 20% move against the user: inside most cushions, and an easy number to picture.
  const target = spot * (rising ? 1.2 : 0.8);
  const start = curve.reduce((b, c, k) => (Math.abs(c.price - target) < Math.abs(curve[b].price - target) ? k : b), 0);
  const [k, setK] = useState(start);
  const pt = curve[Math.min(k, curve.length - 1)];
  const lo = curve[0].price;
  const hi = curve[curve.length - 1].price;
  const at = (price: number) => `${Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100))}%`;
  const move = pt.price / spot - 1;
  const better = pt.hedged - pt.unhedged;

  return (
    <div className="mt-6 rounded-2xl border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-text-2">
          What if {asset} ends at <span className="font-semibold text-text">{usd(pt.price)}</span> on {date}?
        </p>
        <span className={`shrink-0 text-sm font-medium tabular-nums ${move < -0.005 ? "text-bad" : move > 0.005 ? "text-good" : "text-text-2"}`}>
          {move > 0.005 ? "+" : move < -0.005 ? "−" : ""}
          {Math.abs(Math.round(move * 100))}%
        </span>
      </div>

      {/* Track: the teal band is where the hedge pays; the tick is today's price */}
      <div className="relative mt-4">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" aria-hidden>
          <div
            className="absolute inset-y-0 rounded-full bg-accent/35"
            style={{ left: at(Math.min(payFrom, payTo)), right: `calc(100% - ${at(Math.max(payFrom, payTo))})` }}
          />
          <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-text-3" style={{ left: at(spot) }} />
        </div>
        <input
          type="range"
          min={0}
          max={curve.length - 1}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          aria-label={`${asset} price on ${date}`}
          aria-valuetext={`${usd(pt.price)}, ${Math.round(move * 100)}% from today`}
          className="relative w-full cursor-pointer appearance-none bg-transparent accent-[var(--accent)] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow"
        />
      </div>
      {/* Ends of the track, and "today" sitting right under its tick */}
      <div className="relative mt-1 h-4 text-[11px] text-text-3 tabular-nums">
        <span className="absolute left-0">{usd(lo)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `clamp(3.5rem, ${at(spot)}, calc(100% - 3.5rem))` }}>
          today {usd(spot)}
        </span>
        <span className="absolute right-0">{usd(hi)}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-xs text-text-2">Without a hedge</p>
          <p className={`text-2xl font-semibold tabular-nums ${tone(pt.unhedged)}`}>{signed(pt.unhedged)}</p>
        </div>
        <div className="rounded-xl bg-accent-soft px-4 py-3">
          <p className="text-xs text-text-2">With the hedge</p>
          <p className={`text-2xl font-semibold tabular-nums ${tone(pt.hedged)}`}>{signed(pt.hedged)}</p>
        </div>
      </div>
      <p className="mt-2 h-5 text-sm">
        {better > 0.5 ? (
          <span className="font-medium text-good">{usd(better, 0)} better with the hedge</span>
        ) : (
          <span className="text-text-2">The hedge doesn&apos;t pay out here, so it costs you what you paid for it.</span>
        )}
      </p>
    </div>
  );
}

/**
 * A number box with − / + arrows. Typing is allowed, but the value snaps into [min, max]
 * (and onto the step) when you leave the box or press Enter, so it never holds an
 * out-of-range number.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const commit = () => {
    if (draft !== null) {
      const n = Number(draft);
      onChange(clamp(Number.isFinite(n) && draft !== "" ? n : value));
      setDraft(null);
    }
  };
  const fmt = (v: number) => (prefix || suffix ? v.toLocaleString("en-US") : String(v));
  const digits = String(Math.round(max)).length;
  const btn = "flex h-10 w-10 items-center justify-center text-lg text-text-2 transition hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="text-sm">
      <p className="text-text-2">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-surface">
          <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`${label}: less`} className={btn}>
            −
          </button>
          <div className="flex items-center border-x border-border px-2">
            {prefix && <span className="text-text-3">{prefix}</span>}
            <input
              type="text"
              inputMode="numeric"
              value={draft ?? fmt(value)}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, digits))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setDraft(null);
                  onChange(clamp(value + (e.key === "ArrowUp" ? step : -step)));
                }
              }}
              aria-label={label}
              className="h-10 bg-transparent text-center font-semibold tabular-nums outline-none"
              style={{ width: `${Math.max(2, digits + (prefix ? Math.floor((digits - 1) / 3) : 0)) + 1}ch` }}
            />
            {suffix && <span className="text-text-3">{suffix}</span>}
          </div>
          <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`${label}: more`} className={btn}>
            +
          </button>
        </div>
        <span className="text-xs text-text-3">
          {prefix}
          {fmt(min)}–{prefix}
          {fmt(max)}
          {suffix}
        </span>
      </div>
    </div>
  );
}
