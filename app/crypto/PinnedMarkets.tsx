"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { ForecastCard, type FAsset, type FHorizon } from "./ForecastCard";

const NAV = 72; // sticky offset below the site header (px)
const SEG_VH = 60; // scroll distance per market (vh)

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * The markets for each coin, shown one at a time in a card that stays pinned in the
 * middle of the screen. Scrolling swaps the card in place: the current market slides
 * up and out while the next slides up into the same spot. On small screens (where a
 * pinned card wouldn't fit) or with a single coin, it's a normal list.
 */
export function PinnedMarkets({ forecasts, asOf, onProtect }: { forecasts: FAsset[]; asOf: number; onProtect: (f: FAsset, h: FHorizon) => void }) {
  const roomy = useMedia("(min-width: 768px) and (min-height: 760px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const pinned = roomy && forecasts.length > 1;
  const n = forecasts.length;
  const wrap = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const seg = () => (window.innerHeight * SEG_VH) / 100;

  useEffect(() => {
    if (!pinned) return;
    const onScroll = () => {
      const el = wrap.current;
      if (!el) return;
      const scrolled = NAV - el.getBoundingClientRect().top;
      setIndex(Math.min(n - 1, Math.max(0, Math.floor((scrolled + seg() / 2) / seg()))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Gentle snapping so each market settles in place when scrolling stops.
    const html = document.documentElement;
    html.style.scrollSnapType = "y proximity";
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      html.style.scrollSnapType = "";
    };
  }, [pinned, n]);

  const jumpTo = useCallback(
    (i: number) => {
      const el = wrap.current;
      if (!el) return;
      const top = window.scrollY + el.getBoundingClientRect().top - NAV + i * seg();
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion],
  );

  if (!pinned) {
    return (
      <div className="space-y-4">
        {forecasts.map((f) => (
          <ForecastCard key={f.asset} f={f} asOf={asOf} onProtect={(h) => onProtect(f, h)} />
        ))}
      </div>
    );
  }

  const current = Math.min(index, n - 1);
  return (
    <div ref={wrap} className="relative" style={{ height: `calc(100vh - ${NAV + 16}px + ${(n - 1) * SEG_VH}vh)` }}>
      {/* Snap points, one per market */}
      {forecasts.map((f, i) => (
        <div key={f.asset} aria-hidden className="pointer-events-none absolute h-px w-full snap-start" style={{ top: `${i * SEG_VH}vh`, scrollMarginTop: NAV }} />
      ))}

      <div className="sticky flex gap-4" style={{ top: NAV, height: `calc(100vh - ${NAV + 16}px)` }}>
        {/* Which coin you're on */}
        <nav aria-label="Your coins" className="flex w-16 shrink-0 flex-col items-center gap-3 pt-[6vh]">
          {forecasts.map((f, i) => (
            <button
              key={f.asset}
              onClick={() => jumpTo(i)}
              aria-current={i === current}
              aria-label={`Show ${f.asset}`}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-semibold transition ${
                i === current ? "bg-surface text-text ring-1 ring-border" : "text-text-3 opacity-60 hover:opacity-100"
              }`}
            >
              <CoinIcon asset={f.asset} size="sm" />
              {f.asset}
            </button>
          ))}
        </nav>

        {/* The stage: every card occupies the same spot; only the current one shows */}
        {/* Cards share one top edge so the swap happens exactly in place. */}
        <div className="relative grid min-w-0 flex-1 items-start pt-[6vh]">
          {forecasts.map((f, i) => {
            const state = i === current ? "now" : i < current ? "past" : "next";
            return (
              <div
                key={f.asset}
                inert={state !== "now"}
                aria-hidden={state !== "now"}
                className={`[grid-area:1/1] max-h-full overflow-y-auto rounded-2xl transition duration-500 ease-out motion-reduce:transition-none ${
                  state === "now" ? "translate-y-0 opacity-100" : state === "past" ? "pointer-events-none -translate-y-16 opacity-0" : "pointer-events-none translate-y-16 opacity-0"
                }`}
              >
                <ForecastCard f={f} asOf={asOf} onProtect={(h) => onProtect(f, h)} />
              </div>
            );
          })}
          <p className="pointer-events-none absolute -bottom-1 left-0 right-0 text-center text-xs text-text-3">
            {current < n - 1 ? `${current + 1} of ${n} · scroll for ${forecasts[current + 1].asset} ↓` : `${n} of ${n}`}
          </p>
        </div>
      </div>
    </div>
  );
}
