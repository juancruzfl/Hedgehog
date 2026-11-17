"use client";

import Link from "next/link";
import { useState } from "react";
import { OddsSparkline } from "@/components/charts";
import type { BoardCard, BoardCategory } from "@/lib/landing/board";

const TABS: ("All" | BoardCategory)[] = ["All", "Crypto", "Commodities", "Sports"];

/** Semicircle gauge for a probability (0..1). */
function Gauge({ p }: { p: number }) {
  const r = 22;
  const half = Math.PI * r;
  return (
    <div className="relative h-[34px] w-[56px]" role="img" aria-label={`${Math.round(p * 100)} percent chance`}>
      <svg viewBox="0 0 56 32" className="h-full w-full">
        <path d="M6 30 A22 22 0 0 1 50 30" fill="none" stroke="var(--surface-2)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M6 30 A22 22 0 0 1 50 30"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.02, p) * half} ${half}`}
        />
      </svg>
      <span className="absolute inset-x-0 bottom-0 text-center text-[13px] font-bold tabular-nums leading-none">{Math.round(p * 100)}%</span>
    </div>
  );
}

function Card({ c }: { c: BoardCard }) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-text-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-bold tracking-tight text-text-2">
          {c.badge}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{c.title}</h3>
          <p className="mt-0.5 truncate text-xs text-text-3">{c.subtitle}</p>
        </div>
        <div className="flex flex-col items-center">
          <Gauge p={c.prob} />
          <span className="mt-0.5 text-[10px] text-text-3">chance</span>
        </div>
      </div>

      <div className="mt-3 h-12">
        {c.history.length >= 3 ? (
          <OddsSparkline data={c.history.map((h) => ({ ts: h.ts, probBelow: h.p }))} wide />
        ) : (
          <p className="pt-4 text-xs text-text-3">{c.category === "Sports" ? "Game-day market" : "Collecting odds history…"}</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={c.cta.href}
          className="flex-1 rounded-lg bg-accent-soft px-3 py-2 text-center text-sm font-semibold text-accent transition hover:bg-accent hover:text-accent-ink"
        >
          {c.cta.label}
        </Link>
        {c.cost !== null && (
          <span className="rounded-lg bg-surface-2 px-2.5 py-2 text-xs tabular-nums text-text-2" title="What each $1 of payout costs today">
            {Math.round(c.cost * 100)}¢ <span className="text-text-3">per $1</span>
          </span>
        )}
      </div>
    </article>
  );
}

export function RiskBoard({ cards }: { cards: BoardCard[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const shown = tab === "All" ? cards : cards.filter((c) => c.category === tab);
  const counts = Object.fromEntries(TABS.map((t) => [t, t === "All" ? cards.length : cards.filter((c) => c.category === t).length]));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 flex items-center gap-2 text-lg font-bold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
          </span>
          More live markets
        </h2>
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          {TABS.filter((t) => counts[t] > 0).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-sm whitespace-nowrap ${tab === t ? "bg-text font-semibold text-background" : "bg-surface-2 text-text-2 hover:text-text"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-text-3">Odds from Gemini prediction markets</span>
      </div>

      {cards.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-6 text-sm text-text-2">Live markets are unavailable right now.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}
