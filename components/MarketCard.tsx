"use client";

import { useEffect, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { MarketChart } from "@/components/charts";
import type { BoardLine } from "@/lib/landing/board";

// The landing page's market card, shared with the product's trending markets.

export interface MarketCardData {
  category: string; // "Sports" shows kickoff wording
  badge: string; // short avatar text ("NFL", "OIL"); BTC/ETH/SOL show the coin
  tabLabel: string; // small label over the question
  question: string;
  closes: string; // ISO; games: kickoff
  lines: BoardLine[]; // up to three levels (or both teams) for the chart
  spot: { label: string; value: string } | null; // header figure; null shows the close time
  prob: number; // the featured chance
  cost: number | null; // price per $1 if it happens
  /** Says what the big number is the chance of, e.g. "Houston wins" (default "chance"). */
  lead?: string;
}

/** "about 1 in 3" / "a coin flip": odds people can picture. */
export function inWords(p: number): string {
  if (p >= 0.45 && p <= 0.55) return "about a coin flip";
  if (p > 0.55) return p > 0.8 ? "very likely" : "more likely than not";
  if (p < 0.03) return "very unlikely";
  return `about 1 in ${Math.round(1 / p)}`;
}

/** Gemini-style countdown to the close: "01 : 14 : 26" over DAYS HRS MINS. */
function Countdown({ to, label, done }: { to: string; label: string; done: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, Date.parse(to) - now);
  const parts = left === null ? ["--", "--", "--"] : [left / 86_400_000, (left / 3_600_000) % 24, (left / 60_000) % 60].map((n) => String(Math.floor(n)).padStart(2, "0"));
  if (left === 0) {
    return <p className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2">{done}</p>;
  }
  return (
    <div className="shrink-0 text-right" aria-label={`${label} ${parts[0]} days ${parts[1]} hours ${parts[2]} minutes`}>
      <p className="text-[10px] uppercase tracking-wide text-text-3">{label}</p>
      <div className="mt-0.5 flex gap-2 font-mono tabular-nums">
        {parts.map((v, k) => (
          <div key={k} className="text-center">
            <p className="text-base font-semibold leading-none">{v}</p>
            <p className="mt-1 text-[9px] uppercase text-text-3">{["Days", "Hrs", "Mins"][k]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const closeLabel = (iso: string) =>
  `${new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`;


/** A market as the landing page shows it: question, chance, a chart of its levels and the price. */
export function MarketCard({ m }: { m: MarketCardData }) {
  const isGame = m.category === "Sports";
  const hasHistory = m.lines.some((l) => l.history.length >= 3);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      {/* Header: icon, question, countdown */}
      <div className="flex items-start gap-3">
        {["BTC", "ETH", "SOL"].includes(m.badge) ? (
          <CoinIcon asset={m.badge} size="lg" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-text text-[11px] font-bold tracking-wide text-surface">{m.badge}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-3">{m.tabLabel}</p>
          <h2 className="text-xl font-semibold leading-snug sm:text-2xl">{m.question}</h2>
        </div>
        <div className="hidden sm:block">
          <Countdown to={m.closes} label={isGame ? "Kickoff in" : "Closes in"} done={isGame ? "In play" : "Closed"} />
        </div>
      </div>

      {/* Current figure and the featured chance */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          {m.spot ? (
            <>
              <p className="text-xs text-text-3">{m.spot.label}</p>
              <p className="text-lg font-semibold tabular-nums">{m.spot.value}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-text-3">{isGame ? "Kickoff" : "Closes"}</p>
              <p className="text-lg font-semibold">{closeLabel(m.closes)}</p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-4xl font-medium tabular-nums tracking-tight text-accent">{Math.round(m.prob * 100)}%</p>
          <p className="text-xs text-text-2">
            {m.lead ?? "chance"} · {inWords(m.prob)}
          </p>
        </div>
      </div>

      {/* Chart: each level's chance over time, current chance pinned on the right */}
      <div className="mt-3">
        {hasHistory ? (
          <MarketChart lines={m.lines.map((l) => ({ key: l.key, label: l.label, prob: l.prob, data: l.history, featured: l.featured }))} />
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-text-2">Hedgehog starts charting this market once it has a few readings.</p>
        )}
      </div>

      {/* Footer: close time, what it costs */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-text-2">
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
          {isGame ? "Settles after the game" : `Closes ${closeLabel(m.closes)}`}
        </span>
        <span className="tabular-nums">
          Costs <b className="text-text">{m.cost !== null ? `${Math.round(m.cost * 100)}¢` : "—"}</b> per $1 · pays <b className="text-text">$1</b> if it happens
        </span>
      </div>
    </div>
  );
}
