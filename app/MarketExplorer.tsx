"use client";

import Link from "next/link";
import { useState } from "react";
import { OddsAreaChart } from "@/components/charts";
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

function Change({ history }: { history: { ts: number; p: number }[] }) {
  if (history.length < 3) return null;
  const d = history[history.length - 1].p - history[0].p;
  if (Math.abs(d) < 0.005) return <span className="text-sm text-text-3">unchanged since {new Date(history[0].ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
  return (
    <span className={`text-sm font-semibold ${d > 0 ? "text-bad" : "text-good"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(1)} pts
      <span className="font-normal text-text-3"> since {new Date(history[0].ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}</span>
    </span>
  );
}

export function MarketExplorer({ cards }: { cards: BoardCard[] }) {
  const featured = pickFeatured(cards);
  const [i, setI] = useState(0);
  const m = featured[i];
  if (!m) return null;

  return (
    <section aria-labelledby="explorer-title">
      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Powered by Gemini prediction markets
      </p>
      <h1 id="explorer-title" className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
        One market.
        <br />
        <span className="text-accent">Many real-world risks.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-text-2">
        A prediction market pays $1 when an event happens. Anyone who gets hurt by that event can use it to soften the blow. Hedgehog finds the
        market for your risk and shows you what it costs.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-text-3">Pick a live market</p>
        <div role="tablist" aria-label="Featured market" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {featured.map((c, j) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={i === j}
              onClick={() => setI(j)}
              className={`rounded-lg px-3 py-1.5 text-sm ${i === j ? "bg-surface-2 font-semibold text-text" : "text-text-2 hover:text-text"}`}
            >
              {c.badge === "AU" ? "Gold" : c.badge === "OIL" ? "Oil" : c.badge === "NFL" ? "NFL game" : c.badge}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {/* The market */}
        <article className="min-w-0 rounded-2xl border border-border bg-surface p-5 lg:col-span-3">
          <div className="flex items-center gap-2 text-xs text-text-3">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 font-bold text-text-2">{m.badge}</span>
            <span className="min-w-0 truncate">Gemini market · {m.marketName}</span>
          </div>
          <h3 className="mt-3 text-2xl font-bold leading-tight">{m.title}</h3>
          <p className="mt-0.5 text-sm text-text-2">{m.subtitle}</p>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl font-extrabold tabular-nums tracking-tight text-accent">{Math.round(m.prob * 100)}%</span>
            <span className="text-text-2">chance</span>
            <Change history={m.history} />
          </div>

          <div className="mt-4">
            {m.history.length >= 3 ? (
              <OddsAreaChart data={m.history} />
            ) : m.other ? (
              <div className="py-6">
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="bg-accent" style={{ width: `${m.prob * 100}%` }} />
                  <div className="mx-0.5" />
                  <div className="flex-1 bg-text-3" />
                </div>
                <div className="mt-2 flex justify-between text-sm tabular-nums">
                  <span><b>{Math.round(m.prob * 100)}%</b> <span className="text-text-2">{m.title.split(" beats")[0]} wins</span></span>
                  <span><span className="text-text-2">{m.other.label}</span> <b>{Math.round(m.other.prob * 100)}%</b></span>
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-text-3">Odds history is still being collected.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
            <span className="rounded-lg bg-good-soft px-3 py-1.5 font-semibold text-good">Pays $1 if it happens</span>
            {m.cost !== null && (
              <span className="rounded-lg bg-surface-2 px-3 py-1.5 tabular-nums text-text-2">
                costs <b className="text-text">{Math.round(m.cost * 100)}¢</b> today
              </span>
            )}
            <span className="text-xs text-text-3">Live odds from Gemini prediction markets</span>
          </div>
        </article>

        {/* Who can use it */}
        <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-3">Risks this market can offset</h3>
          <ul className="mt-3 divide-y divide-border">
            {m.uses.map((u) => (
              <li key={u.who}>
                <Link href={u.href} className="group flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{u.who}</p>
                    <p className="text-sm text-text-2">{u.risk}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent transition group-hover:bg-accent group-hover:text-accent-ink">
                    Hedge →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
