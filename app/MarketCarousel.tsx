"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BusinessIcon } from "@/components/BusinessIcon";
import { CoinIcon } from "@/components/CoinIcon";
import { MarketChart } from "@/components/charts";
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

// Desktop positions for the four floating risk widgets (corners of the stage), and
// where each connector line meets them (in % of the stage, matching the widget corner).
const SPOTS = [
  { pos: "left-0 top-4", line: { x: 22, y: 22 }, delay: "0s" },
  { pos: "right-0 top-10", line: { x: 78, y: 28 }, delay: "-1.2s" },
  { pos: "left-6 bottom-2", line: { x: 24, y: 76 }, delay: "-2.4s" },
  { pos: "right-6 bottom-0", line: { x: 76, y: 80 }, delay: "-3.6s" },
];

/** Gemini-style countdown to the close: "01 : 14 : 26" over DAYS HRS MINS. */
function Countdown({ to, label }: { to: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, Date.parse(to) - now);
  const parts = left === null ? ["--", "--", "--"] : [left / 86_400_000, (left / 3_600_000) % 24, (left / 60_000) % 60].map((n) => String(Math.floor(n)).padStart(2, "0"));
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

const closeLabel = (iso: string) =>
  `${new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`;

function MarketCard({ m }: { m: BoardCard }) {
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
          <Countdown to={m.closes} label={isGame ? "Kickoff in" : "Closes in"} />
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
              <p className="text-xs text-text-3">Kickoff</p>
              <p className="text-lg font-semibold">{closeLabel(m.closes)}</p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-4xl font-medium tabular-nums tracking-tight text-accent">{Math.round(m.prob * 100)}%</p>
          <p className="text-xs text-text-2">chance · {inWords(m.prob)}</p>
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
  // A payout slip: who it's for and what sets it off on top, the deal below a perforated line.
  return (
    <Link
      href={u.href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={`group relative block overflow-hidden rounded-2xl border bg-surface transition duration-200 ${
        active ? "scale-[1.03] border-accent" : "border-border"
      } ${dim ? "opacity-45" : "opacity-100"}`}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <BusinessIcon who={u.who} />
          </span>
          <p className="min-w-0 flex-1 truncate font-semibold">{u.who}</p>
          <span className="text-accent transition group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-accent">{u.trigger}</p>
        <p className="mt-0.5 text-sm leading-snug text-text-2">{u.risk}</p>
      </div>
      {stake !== null && (
        <div className="relative border-t border-dashed border-border px-4 py-3">
          {/* Ticket notches where the slip "tears" */}
          <span className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border border-border bg-background" aria-hidden />
          <span className="absolute -right-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border border-border bg-background" aria-hidden />
          <div className="flex items-end gap-3 tabular-nums">
            <div>
              <p className="text-[11px] text-text-3">Put in</p>
              <p className="text-lg font-semibold leading-tight">{usd(stake)}</p>
            </div>
            <span className="pb-0.5 text-text-3" aria-hidden>
              →
            </span>
            <div>
              <p className="text-[11px] text-text-3">Get back</p>
              <p className="text-lg font-semibold leading-tight text-good">{usd(u.payout)}</p>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only">See my numbers</span>
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
          <div className="relative hidden h-[550px] lg:block">
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
            <div className="absolute left-1/2 top-1/2 z-10 w-[540px] -translate-x-1/2 -translate-y-1/2">
              <MarketCard m={m} />
            </div>
            {uses.map((u, k) => (
              <div key={u.who} className={`absolute z-20 w-[250px] ${SPOTS[k].pos}`}>
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
