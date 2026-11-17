"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const SEG_VH = 60; // scroll distance per card (vh)
const MIN_SCALE = 0.75; // below this, a card scrolls inside instead of shrinking further
const ROW = 52; // room for the chip row under the card (px)

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

export interface StageItem {
  key: string;
  /** Used in "2 of 3 · scroll for <label>". */
  label: string;
  /** Contents of this item's chip in the row under the card. */
  chip: React.ReactNode;
}

/**
 * A header, one card and a chip row, pinned together as one view. Scrolling doesn't
 * move the view; it swaps the card in place (current slides up and out, next slides up
 * in). After the last card the page continues normally. Phones/short windows and a
 * single item get a normal layout. Used by the crypto markets and business options.
 */
export function PinnedStage({
  header,
  items,
  renderCard,
  status,
}: {
  header: React.ReactNode;
  items: StageItem[];
  renderCard: (index: number) => React.ReactNode;
  /** Replaces the "1 of 3" hint, e.g. "Updating odds…". */
  status?: string | null;
}) {
  const roomy = useMedia("(min-width: 768px) and (min-height: 500px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const nav = useNavHeight();
  const n = items.length;
  const pinned = roomy && n > 1;
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef(new Map<string, HTMLDivElement>());
  const [index, setIndex] = useState(0);
  const [fit, setFit] = useState<Record<string, { scale: number; maxH: number }>>({});
  const [rowTop, setRowTop] = useState<number | null>(null);
  const keys = items.map((i) => i.key).join("|");

  const seg = () => (window.innerHeight * SEG_VH) / 100;

  // Which card is showing, from how far the user has scrolled through the section.
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
    html.style.scrollSnapType = "y proximity"; // each card settles in place
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      html.style.scrollSnapType = "";
    };
  }, [pinned, n, nav]);

  // Scale each card to fit between the header and the chip row.
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
      setRowTop(tallest + 12); // just under the tallest card, so it doesn't jump
    };
    measure();
    const ro = new ResizeObserver(measure);
    inner.current.forEach((el) => ro.observe(el));
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [pinned, keys]);

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
          {items.map((it, i) => (
            <div key={it.key}>{renderCard(i)}</div>
          ))}
        </div>
      </div>
    );
  }

  const current = Math.min(index, n - 1);
  return (
    <div ref={wrap} className="relative" style={{ height: `calc(100vh - ${nav}px + ${(n - 1) * SEG_VH}vh)` }}>
      {items.map((it, i) => (
        <div key={it.key} aria-hidden className="pointer-events-none absolute h-px w-full snap-start" style={{ top: `${i * SEG_VH}vh`, scrollMarginTop: nav }} />
      ))}

      <div className="sticky flex flex-col" style={{ top: nav, height: `calc(100vh - ${nav}px)` }}>
        <div className="shrink-0 pb-4 pt-6 [@media(max-height:800px)]:pb-3 [@media(max-height:800px)]:pt-4">{header}</div>

        <div ref={stage} className="relative grid min-h-0 flex-1 items-start">
          {items.map((it, i) => {
            const state = i === current ? "now" : i < current ? "past" : "next";
            return (
              <div
                key={it.key}
                inert={state !== "now"}
                aria-hidden={state !== "now"}
                data-stage-card
                style={{ scale: fit[it.key]?.scale ?? 1, transformOrigin: "top center", maxHeight: fit[it.key]?.maxH }}
                className={`[grid-area:1/1] overflow-y-auto rounded-2xl transition-[translate,opacity] duration-500 ease-out motion-reduce:transition-none ${
                  state === "now" ? "translate-y-0 opacity-100" : state === "past" ? "pointer-events-none -translate-y-16 opacity-0" : "pointer-events-none translate-y-16 opacity-0"
                }`}
              >
                <div
                  ref={(el) => {
                    if (el) inner.current.set(it.key, el);
                    else inner.current.delete(it.key);
                  }}
                >
                  {renderCard(i)}
                </div>
              </div>
            );
          })}

          <div className="absolute inset-x-0 flex flex-wrap items-center justify-center gap-2" style={{ top: rowTop ?? undefined, bottom: rowTop === null ? 0 : undefined }}>
            <nav aria-label="Switch card" className="flex flex-wrap items-center justify-center gap-2">
              {items.map((it, i) => (
                <button
                  key={it.key}
                  onClick={() => jumpTo(i)}
                  aria-current={i === current}
                  aria-label={`Show ${it.label}`}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    i === current ? "border-accent bg-surface text-text" : "border-border bg-surface/60 text-text-3 hover:text-text"
                  }`}
                >
                  {it.chip}
                </button>
              ))}
            </nav>
            <span className="text-xs text-text-3">
              {status ?? (current < n - 1 ? `${current + 1} of ${n} · scroll for ${items[current + 1].label} ↓` : `${n} of ${n}`)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
