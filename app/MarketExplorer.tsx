"use client";

import Link from "next/link";
import { useState } from "react";
import { OddsAreaChart } from "@/components/charts";
import { usd } from "@/lib/format";
import type { BoardCard } from "@/lib/landing/board";

const FEATURED_ORDER = ["OIL", "SOL", "NFL", "AU", "BTC"];

function pickFeatured(cards: BoardCard[]): BoardCard[] {
  const out: BoardCard[] = [];
  for (const badge of FEATURED_ORDER) {
    const c = cards.find((x) => x.badge === badge && !out.includes(x));
    if (c) out.push(c);
    if (out.length === 4) break;
  }
  return out;
}

/** "about 1 in 5" / "a coin flip" / "likely": odds people can picture. */
function inWords(p: number): string {
  if (p >= 0.45 && p <= 0.55) return "about a coin flip";
  if (p > 0.55) return p > 0.8 ? "very likely" : "more likely than not";
  if (p < 0.03) return "very unlikely";
  return `about 1 in ${Math.round(1 / p)}`;
}

/** The question already says "by <date>", so keep only the extra context, in words. */
function context(subtitle: string): string {
  const rest = subtitle.replace(/^by [^·]+·\s*/, "");
  return rest.replace(/^market expects ~/, "Market expects about ").replace(/ now$/, " today").replace(/^\$/, "It's $");
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-text-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{n}</span>
      {children}
    </p>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3 sm:px-4">
      <p className="text-[11px] text-text-2 sm:text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="text-[11px] leading-snug text-text-3 sm:text-xs">{note}</p>
    </div>
  );
}

export function MarketExplorer({ cards }: { cards: BoardCard[] }) {
  const featured = pickFeatured(cards);
  const [i, setI] = useState(0);
  const m = featured[i];
  if (!m) return null;
  const pct = Math.round(m.prob * 100);

  return (
    <section aria-labelledby="explorer-title">
      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Live odds from Gemini prediction markets
      </p>
      <h1 id="explorer-title" className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
        One market.
        <br />
        <span className="text-accent">Many real-world risks.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-text-2">
        A prediction market pays out if something happens. If that same thing would cost you money, the payout softens the hit. Pick a market
        below to see who it can protect.
      </p>

      {/* Step 1: pick a market */}
      <div className="mt-10">
        <StepLabel n={1}>Pick a live market</StepLabel>
        <div role="tablist" aria-label="Live markets" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {featured.map((c, j) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={i === j}
              onClick={() => setI(j)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                i === j ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-text-3"
              }`}
            >
              <span className="block text-sm font-semibold">{c.tabLabel}</span>
              <span className="mt-0.5 block text-xs text-text-2 tabular-nums">{Math.round(c.prob * 100)}% chance</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* The market, in plain English */}
        <article className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-3">
          <h2 className="text-2xl font-bold leading-tight sm:text-[28px]">{m.question}</h2>
          <p className="mt-1 text-sm text-text-2">{context(m.subtitle)}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="Chance it happens" value={`${pct}%`} note={inWords(m.prob)} />
            <Stat label="Costs today" value={m.cost !== null ? `${Math.round(m.cost * 100)}¢` : "—"} note="for each $1 of payout" />
            <Stat label="Pays if it happens" value="$1" note="per contract, from Gemini" />
          </div>

          {m.history.length >= 3 ? (
            <div className="mt-5">
              <p className="text-sm font-medium">How the odds have moved</p>
              <div className="mt-2">
                <OddsAreaChart data={m.history} height={250} />
              </div>
            </div>
          ) : m.other ? (
            <div className="mt-6">
              <p className="text-sm font-medium">What the market expects</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-accent" style={{ width: `${m.prob * 100}%` }} />
                <div className="w-0.5 bg-surface" />
                <div className="flex-1 bg-surface-2" />
              </div>
              <div className="mt-2 flex justify-between text-sm tabular-nums">
                <span>
                  <b>{pct}%</b> <span className="text-text-2">{m.title.split(" beats")[0]} wins</span>
                </span>
                <span>
                  <span className="text-text-2">{m.other.label}</span> <b>{Math.round(m.other.prob * 100)}%</b>
                </span>
              </div>
            </div>
          ) : null}

          <p className="mt-5 border-t border-border pt-3 text-xs text-text-3">
            Source: Gemini prediction market &ldquo;{m.marketName}&rdquo;. Prices update every minute.
          </p>
        </article>

        {/* Step 2: who it protects */}
        <aside className="min-w-0 lg:col-span-2">
          <StepLabel n={2}>See who it protects</StepLabel>
          <ul className="mt-3 space-y-2">
            {m.uses.map((u) => {
              const stake = m.cost !== null ? Math.max(1, Math.round(u.payout * m.cost)) : null;
              return (
                <li key={u.who}>
                  <Link href={u.href} className="group block rounded-xl border border-border bg-surface p-4 transition hover:border-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{u.who}</p>
                        <p className="text-sm text-text-2">{u.risk}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-accent group-hover:underline">See my numbers →</span>
                    </div>
                    {stake !== null && (
                      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm tabular-nums">
                        Put in <b>{usd(stake)}</b> → get <b>{usd(u.payout)}</b> back if it happens
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-text-3">Example amounts. Your numbers depend on your own costs.</p>
        </aside>
      </div>
    </section>
  );
}
