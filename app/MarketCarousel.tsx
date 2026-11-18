"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OddsSparkline } from "@/components/charts";
import { usd } from "@/lib/format";
import type { BoardCard } from "@/lib/landing/board";
import type { RiskUse } from "@/lib/landing/uses";

const FEATURED_ORDER = ["OIL", "SOL", "NFL", "AU", "BTC"];
const SLIDE_MS = 7000;

function pickFeatured(cards: BoardCard[]): BoardCard[] {
  const out: BoardCard[] = [];
  for (const badge of FEATURED_ORDER) {
    const c = cards.find((x) => x.badge === badge && !out.includes(x));
    if (c) out.push(c);
    if (out.length === 4) break;
  }
  return out;
}

/** "about 1 in 3" / "a coin flip": odds people can picture. */
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

// Desktop positions for the four floating risk widgets (corners of the stage), and
// where each connector line meets them (in % of the stage, matching the widget corner).
const SPOTS = [
  { pos: "left-0 top-4", line: { x: 22, y: 22 }, delay: "0s" },
  { pos: "right-0 top-10", line: { x: 78, y: 28 }, delay: "-1.2s" },
  { pos: "left-6 bottom-2", line: { x: 24, y: 76 }, delay: "-2.4s" },
  { pos: "right-6 bottom-0", line: { x: 76, y: 80 }, delay: "-3.6s" },
];

function MarketCard({ m }: { m: BoardCard }) {
  const pct = Math.round(m.prob * 100);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">{m.tabLabel}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">{m.question}</h2>
      <p className="mt-1 text-sm text-text-2">{context(m.subtitle)}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-5xl font-extrabold tabular-nums tracking-tight text-accent">{pct}%</p>
          <p className="mt-1 text-sm text-text-2">chance · {inWords(m.prob)}</p>
        </div>
        {m.history.length >= 3 && <OddsSparkline data={m.history.map((h) => ({ ts: h.ts, probBelow: h.p }))} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <p className="text-xs text-text-2">Costs today</p>
          <p className="font-bold tabular-nums">{m.cost !== null ? `${Math.round(m.cost * 100)}¢ per $1` : "—"}</p>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <p className="text-xs text-text-2">If it happens</p>
          <p className="font-bold">Pays $1 each</p>
        </div>
      </div>
    </div>
  );
}

function RiskWidget({
  u,
  cost,
  dim,
  active,
  onEnter,
  onLeave,
}: {
  u: RiskUse;
  cost: number | null;
  dim: boolean;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const stake = cost !== null ? Math.max(1, Math.round(u.payout * cost)) : null;
  return (
    <Link
      href={u.href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={`block rounded-2xl border bg-surface/75 p-4 backdrop-blur-sm transition duration-200 ${
        active ? "scale-[1.03] border-accent bg-surface" : "border-border"
      } ${dim ? "opacity-45" : "opacity-100"}`}
    >
      <p className="font-semibold">{u.who}</p>
      <p className="text-sm text-text-2">{u.risk}</p>
      {stake !== null && (
        <p className="mt-2 text-sm tabular-nums">
          Put in <b>{usd(stake)}</b> → get <b>{usd(u.payout)}</b> back
        </p>
      )}
      <p className="mt-2 text-sm font-semibold text-accent">See my numbers →</p>
    </Link>
  );
}

export function MarketCarousel({ cards }: { cards: BoardCard[] }) {
  const featured = pickFeatured(cards);
  const [i, setI] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const paused = hovering || reduceMotion;

  // Rotate to the next market every SLIDE_MS unless the user is hovering/focusing or paused it.
  useEffect(() => {
    if (paused || featured.length < 2) return;
    const t = setTimeout(() => {
      setActiveWidget(null);
      setI((x) => (x + 1) % featured.length);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, paused, featured.length]);

  const m = featured[i];
  if (!m) return null;
  const uses = m.uses.slice(0, 4);

  return (
    <section aria-roledescription="carousel" aria-label="Live markets and the risks they cover" className={paused ? "hh-paused" : ""}>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setHovering(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
        }}
      >
        {/* Stage */}
        <div key={m.id} className="hh-slide-in" aria-live={paused ? "polite" : "off"}>
          {/* Desktop: market in the middle, risks floating around it */}
          <div className="relative hidden h-[480px] lg:block">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {SPOTS.slice(0, uses.length).map((s, k) => (
                <line
                  key={k}
                  x1={50}
                  y1={50}
                  x2={s.line.x}
                  y2={s.line.y}
                  stroke={activeWidget === uses[k].who ? "var(--accent)" : "var(--border)"}
                  strokeWidth={activeWidget === uses[k].who ? 2 : 1.5}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="absolute left-1/2 top-1/2 z-10 w-[380px] -translate-x-1/2 -translate-y-1/2">
              <MarketCard m={m} />
            </div>
            {uses.map((u, k) => (
              <div key={u.who} className={`absolute z-20 w-[270px] ${SPOTS[k].pos}`}>
                <div className="hh-float" style={{ animationDelay: SPOTS[k].delay }}>
                  <RiskWidget
                    u={u}
                    cost={m.cost}
                    dim={activeWidget !== null && activeWidget !== u.who}
                    active={activeWidget === u.who}
                    onEnter={() => setActiveWidget(u.who)}
                    onLeave={() => setActiveWidget(null)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Mobile / tablet: market, then its risks */}
          <div className="lg:hidden">
            <MarketCard m={m} />
            <p className="mt-5 text-sm font-semibold text-text-2">Who this market can help</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {uses.map((u) => (
                <RiskWidget
                  key={u.who}
                  u={u}
                  cost={m.cost}
                  dim={activeWidget !== null && activeWidget !== u.who}
                  active={activeWidget === u.who}
                  onEnter={() => setActiveWidget(u.who)}
                  onLeave={() => setActiveWidget(null)}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-3">
          Live market: &ldquo;{m.marketName}&rdquo;. Example amounts; your numbers depend on your own costs.
        </p>
      </div>
    </section>
  );
}
