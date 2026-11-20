"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BusinessIcon } from "@/components/BusinessIcon";
import { CoinIcon } from "@/components/CoinIcon";
import { closeLabel, inWords, MarketCard } from "@/components/MarketCard";
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


// Desktop positions for the four floating risk widgets (corners of the stage), and
// where each connector line meets them (in % of the stage, matching the widget corner).
const SPOTS = [
  { pos: "left-0 top-4", line: { x: 22, y: 22 }, delay: "0s" },
  { pos: "right-0 top-10", line: { x: 78, y: 28 }, delay: "-1.2s" },
  { pos: "left-6 bottom-2", line: { x: 24, y: 76 }, delay: "-2.4s" },
  { pos: "right-6 bottom-0", line: { x: 76, y: 80 }, delay: "-3.6s" },
];


/** A tiny line of the featured level's chance over time, with the current reading as a dot. */
function Sparkline({ data, prob }: { data: { ts: number; p: number }[]; prob: number }) {
  const W = 300;
  const H = 52;
  const pts = data.length >= 2 ? data : [{ ts: 0, p: prob }, { ts: 1, p: prob }];
  const t0 = pts[0].ts;
  const t1 = pts.at(-1)!.ts || 1;
  const hi = Math.min(1, Math.max(...pts.map((d) => d.p), prob) + 0.05);
  const lo = Math.max(0, Math.min(...pts.map((d) => d.p), prob) - 0.05);
  const x = (ts: number) => ((ts - t0) / (t1 - t0 || 1)) * (W - 6);
  const y = (p: number) => 4 + (1 - (p - lo) / (hi - lo || 1)) * (H - 8);
  const line = pts.map((d) => `${x(d.ts).toFixed(1)},${y(d.p).toFixed(1)}`).join(" ");
  const end = { x: x(pts.at(-1)!.ts), y: y(prob) };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[52px] w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${H} ${line} ${end.x},${H}`} fill="var(--accent)" opacity={0.08} />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={end.x} cy={end.y} r={3} fill="var(--accent)" />
    </svg>
  );
}

/** The market card for phones: question, chance, a sparkline and the price, small enough for the risks to sit around it. */
function MiniMarketCard({ m }: { m: BoardCard }) {
  const featured = m.lines.find((l) => l.featured) ?? m.lines[0];
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_8px_24px_-12px_rgba(12,10,8,0.18)]">
      <div className="flex items-start gap-2.5">
        {["BTC", "ETH", "SOL"].includes(m.badge) ? (
          <CoinIcon asset={m.badge} />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-text text-[9px] font-bold tracking-wide text-surface">{m.badge}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-text-3">{m.tabLabel}</p>
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug">{m.question}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[26px] font-medium leading-none tabular-nums tracking-tight text-accent">{Math.round(m.prob * 100)}%</p>
          <p className="mt-1 text-[10px] text-text-2">{inWords(m.prob)}</p>
        </div>
      </div>
      {featured && featured.history.length >= 3 && (
        <div className="mt-2">
          <Sparkline data={featured.history} prob={featured.prob} />
        </div>
      )}
      <p className="mt-2 flex justify-between gap-2 border-t border-border pt-2 text-[11px] tabular-nums text-text-2">
        <span className="truncate">{m.spot ? `${m.spot.label} ${m.spot.value}` : `Kickoff ${closeLabel(m.closes)}`}</span>
        <span className="shrink-0">
          Costs <b className="text-text">{m.cost !== null ? `${Math.round(m.cost * 100)}¢` : "—"}</b> · pays <b className="text-text">$1</b>
        </span>
      </p>
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

// Phone stage: the desktop widgets (designed 250px wide) scaled to just under half the
// screen, staggered like the desktop corners (offsets in design px, so they scale too).
const PHONE_SPOTS = [
  { offset: "mt-0", delay: SPOTS[0].delay },
  { offset: "mt-7", delay: SPOTS[1].delay },
  { offset: "ml-3 mt-3", delay: SPOTS[2].delay },
  { offset: "mr-3", delay: SPOTS[3].delay },
];

/**
 * The desktop stage at phone size: the market in the middle, the same risk widgets scaled
 * down at its four corners, and a dashed line from the market to each. Line ends are
 * measured, since card and widget heights change with the market.
 */
function PhoneStage({
  m,
  uses,
  activeWidget,
  setActiveWidget,
}: {
  m: BoardCard;
  uses: RiskUse[];
  activeWidget: string | null;
  setActiveWidget: (w: string | null) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const spots = useRef<(HTMLDivElement | null)[]>([]);
  const [zoom, setZoom] = useState(0.68);
  const [geo, setGeo] = useState<{ w: number; h: number; c: { x: number; y: number }; ends: { x: number; y: number }[] } | null>(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const s = el.getBoundingClientRect();
      setZoom(Math.min(1, (s.width * 0.48) / 250));
      const c = card.current!.getBoundingClientRect();
      // Each line meets its widget at the inner corner nearest the market, as on desktop.
      const ends = spots.current.slice(0, uses.length).map((d, k) => {
        const r = d!.getBoundingClientRect();
        const left = k % 2 === 0;
        const top = k < 2;
        return { x: (left ? r.right - 12 : r.left + 12) - s.left, y: (top ? r.bottom - 6 : r.top + 6) - s.top };
      });
      setGeo({ w: s.width, h: s.height, c: { x: c.left + c.width / 2 - s.left, y: c.top + c.height / 2 - s.top }, ends });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [uses.length]);

  const widget = (k: number) =>
    uses[k] && (
      <div ref={(d) => void (spots.current[k] = d)} style={{ zoom }} className={`w-[250px] ${PHONE_SPOTS[k].offset}`}>
        <div className="hh-float" style={{ animationDelay: PHONE_SPOTS[k].delay }}>
          <RiskWidget
            u={uses[k]}
            cost={m.cost}
            dim={activeWidget !== null && activeWidget !== uses[k].who}
            active={activeWidget === uses[k].who}
            onEnter={() => setActiveWidget(uses[k].who)}
            onLeave={() => setActiveWidget(null)}
          />
        </div>
      </div>
    );

  return (
    <div ref={stage} className="relative">
      {geo && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden>
          {geo.ends.map((e, k) => (
            <line
              key={k}
              x1={geo.c.x}
              y1={geo.c.y}
              x2={e.x}
              y2={e.y}
              stroke={activeWidget === uses[k]?.who ? "var(--accent)" : "var(--border)"}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ))}
        </svg>
      )}
      <div className="relative z-20 flex items-start justify-between">
        {widget(0)}
        {widget(1)}
      </div>
      <div ref={card} className="relative z-10 mx-auto my-6 w-[84%] max-w-[420px]">
        <MiniMarketCard m={m} />
      </div>
      <div className="relative z-20 flex items-start justify-between">
        {widget(2)}
        {widget(3)}
      </div>
    </div>
  );
}

/** One market and the risks it covers, floating around it. */
function Slide({
  m,
  activeWidget,
  setActiveWidget,
}: {
  m: BoardCard;
  activeWidget: string | null;
  setActiveWidget: (w: string | null) => void;
}) {
  const uses = m.uses.slice(0, 4);
  return (
    <>
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

      {/* Phones / tablets: the same stage, sized down */}
      <div className="lg:hidden">
        <PhoneStage m={m} uses={uses} activeWidget={activeWidget} setActiveWidget={setActiveWidget} />
      </div>

      <p className="mt-3 text-xs text-text-3">
        Live market: &ldquo;{m.marketName}&rdquo;. Example amounts; your numbers depend on your own costs.
      </p>
    </>
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

  if (!featured[i]) return null;

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
        {/* Stage: every slide sits in the same grid cell, so the stage is always as tall as the
            tallest one and nothing below it moves when the market rotates. */}
        <div className="grid grid-cols-1">
          {featured.map((f, k) => (
            <div
              key={f.id}
              className={`[grid-area:1/1] ${k === i ? "hh-slide-in" : "invisible"}`}
              aria-hidden={k !== i}
              inert={k !== i}
              aria-live={k === i && paused ? "polite" : "off"}
            >
              <Slide m={f} activeWidget={k === i ? activeWidget : null} setActiveWidget={setActiveWidget} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
