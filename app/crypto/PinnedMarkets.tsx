"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { ForecastCard, type FAsset, type FHorizon } from "./ForecastCard";

const SEG_VH = 60; // scroll distance per market (vh)
const MIN_SCALE = 0.75; // below this, a card scrolls inside instead of shrinking further
const ROW = 56; // room for the coin row under the card (px)

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

/** Height of the sticky site header, so the pinned view sits right under it. */
function useNavHeight() {
  const [h, setH] = useState(57);
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return;
    const update = () => setH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/**
 * The page title, one market card and a row of coin buttons, pinned together as one
 * view. Scrolling doesn't move the view; it swaps the card in place (the current
 * market slides up and out, the next slides up in). After the last coin the page
 * continues normally. Phones/short windows and single coins get a normal layout.
 */
export function PinnedMarkets({
  header,
  updating,
  forecasts,
  asOf,
  onProtect,
}: {
  header: React.ReactNode;
  updating: boolean;
  forecasts: FAsset[];
  asOf: number;
  onProtect: (f: FAsset, h: FHorizon) => void;
}) {
  const roomy = useMedia("(min-width: 768px) and (min-height: 500px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const nav = useNavHeight();
  const n = forecasts.length;
  const pinned = roomy && n > 1;
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef(new Map<string, HTMLDivElement>());
  const [index, setIndex] = useState(0);
  const [fit, setFit] = useState<Record<string, { scale: number; maxH: number }>>({});
  const [rowTop, setRowTop] = useState<number | null>(null);

  const seg = () => (window.innerHeight * SEG_VH) / 100;

  // Which market is showing, from how far the user has scrolled through the section.
  useEffect(() => {
    if (!pinned) return;
    const onScroll = () => {
      const el = wrap.current;
      if (!el) return;
      const scrolled = nav - el.getBoundingClientRect().top;
      setIndex(Math.min(n - 1, Math.max(0, Math.floor((scrolled + seg() / 2) / seg()))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const html = document.documentElement;
    html.style.scrollSnapType = "y proximity"; // each market settles in place
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      html.style.scrollSnapType = "";
    };
  }, [pinned, n, nav]);

  // Scale each card to fit the space between the title and the coin row.
  useLayoutEffect(() => {
    if (!pinned) return;
    const measure = () => {
      const st = stage.current;
      if (!st) return;
      const avail = st.clientHeight - ROW;
      const next: Record<string, { scale: number; maxH: number }> = {};
      let tallest = 0;
      inner.current.forEach((el, key) => {
        const scale = Math.max(MIN_SCALE, Math.min(1, avail / el.scrollHeight));
        next[key] = { scale, maxH: avail / scale };
        tallest = Math.max(tallest, Math.min(avail, el.scrollHeight * scale));
      });
      setFit(next);
      // The coin row sits just under the tallest card, so it doesn't jump between coins.
      setRowTop(tallest + 12);
    };
    measure();
    const ro = new ResizeObserver(measure);
    inner.current.forEach((el) => ro.observe(el));
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [pinned, n]);

  const jumpTo = useCallback(
    (i: number) => {
      const el = wrap.current;
      if (!el) return;
      const top = window.scrollY + el.getBoundingClientRect().top - nav + i * seg();
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion, nav],
  );

  if (!pinned) {
    return (
      <div className="space-y-8 pt-10">
        {header}
        <div className="space-y-4">
          {forecasts.map((f) => (
            <ForecastCard key={f.asset} f={f} asOf={asOf} onProtect={(h) => onProtect(f, h)} />
          ))}
        </div>
      </div>
    );
  }

  const current = Math.min(index, n - 1);
  return (
    <div ref={wrap} className="relative" style={{ height: `calc(100vh - ${nav}px + ${(n - 1) * SEG_VH}vh)` }}>
      {/* Snap points, one per market */}
      {forecasts.map((f, i) => (
        <div key={f.asset} aria-hidden className="pointer-events-none absolute h-px w-full snap-start" style={{ top: `${i * SEG_VH}vh`, scrollMarginTop: nav }} />
      ))}

      {/* The fixed view: title, card, coin row */}
      <div className="sticky flex flex-col" style={{ top: nav, height: `calc(100vh - ${nav}px)` }}>
        <div className="shrink-0 pb-4 pt-6">{header}</div>

        <div ref={stage} className="relative grid min-h-0 flex-1 items-start">
          {forecasts.map((f, i) => {
            const state = i === current ? "now" : i < current ? "past" : "next";
            return (
              <div
                key={f.asset}
                inert={state !== "now"}
                aria-hidden={state !== "now"}
                style={{ scale: fit[f.asset]?.scale ?? 1, transformOrigin: "top center", maxHeight: fit[f.asset]?.maxH }}
                className={`[grid-area:1/1] overflow-y-auto rounded-2xl transition-[translate,opacity] duration-500 ease-out motion-reduce:transition-none ${
                  state === "now" ? "translate-y-0 opacity-100" : state === "past" ? "pointer-events-none -translate-y-16 opacity-0" : "pointer-events-none translate-y-16 opacity-0"
                }`}
              >
                <div
                  ref={(el) => {
                    if (el) inner.current.set(f.asset, el);
                    else inner.current.delete(f.asset);
                  }}
                >
                  <ForecastCard f={f} asOf={asOf} onProtect={(h) => onProtect(f, h)} />
                </div>
              </div>
            );
          })}
          {/* Coin row under the card */}
          <div className="absolute inset-x-0 flex flex-wrap items-center justify-center gap-2" style={{ top: rowTop ?? undefined, bottom: rowTop === null ? 0 : undefined }}>
            <nav aria-label="Your coins" className="flex items-center gap-2">
              {forecasts.map((f, i) => (
                <button
                  key={f.asset}
                  onClick={() => jumpTo(i)}
                  aria-current={i === current}
                  aria-label={`Show ${f.asset}`}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    i === current ? "border-accent bg-surface text-text" : "border-border bg-surface/60 text-text-3 hover:text-text"
                  }`}
                >
                  <CoinIcon asset={f.asset} size="sm" className={i === current ? "" : "opacity-60"} />
                  {f.asset}
                </button>
              ))}
            </nav>
            <span className="text-xs text-text-3">
              {updating ? "Updating odds…" : current < n - 1 ? `${current + 1} of ${n} · scroll for ${forecasts[current + 1].asset} ↓` : `${n} of ${n}`}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
