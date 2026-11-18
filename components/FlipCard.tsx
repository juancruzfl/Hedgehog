"use client";

import { useEffect, useRef, useState } from "react";
import { OddsHistoryChart, type OddsSeries } from "@/components/charts";

const face = "rounded-2xl border border-border bg-surface p-5 sm:p-6 [backface-visibility:hidden]";

/**
 * A card with the details on the front and how the odds have moved on the back.
 * The back lies over the front, so flipping never changes the card's size, and each
 * card flips on its own. Without enough readings yet, the front explains why.
 */
export function FlipCard({
  front,
  footer,
  series,
  backTitle,
  backSub,
}: {
  /** Card body; the flip link is placed after it. */
  front: React.ReactNode;
  /** Bottom row (e.g. the main button); stays pinned to the bottom. */
  footer: React.ReactNode;
  /** Odds over time, one line per contract. Undefined while loading. */
  series: OddsSeries[] | undefined;
  backTitle: string;
  backSub?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  // The chart on the back is only built once someone flips the card (it's the costly part).
  const [everFlipped, setEverFlipped] = useState(false);
  if (flipped && !everFlipped) setEverFlipped(true);
  const flipRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // Move keyboard focus to the side that's now showing (not on first render).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    (flipped ? backRef : flipRef).current?.focus({ preventScroll: true });
  }, [flipped]);

  const hasHistory = !!series?.some((s) => s.data.length >= 3);

  return (
    <div className="flex flex-col [perspective:1600px]">
      <div
        className="relative flex flex-1 flex-col transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        <article className={`${face} flex flex-1 flex-col`} inert={flipped} aria-hidden={flipped}>
          {front}
          <div className="mb-5 mt-4">
            {hasHistory ? (
              <button ref={flipRef} onClick={() => setFlipped(true)} className="text-sm font-medium text-accent hover:underline">
                See how these odds have moved ↻
              </button>
            ) : (
              <p className="text-sm text-text-3">
                {series === undefined ? "Loading odds history…" : "Odds history shows up after a few readings (one every 5 minutes)."}
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-4">{footer}</div>
        </article>

        {hasHistory && (
          <article
            className={`${face} absolute inset-0 flex flex-col overflow-y-auto`}
            style={{ transform: "rotateY(180deg)" }}
            inert={!flipped}
            aria-hidden={!flipped}
            aria-label={backTitle}
          >
            <p className="font-semibold">{backTitle}</p>
            {backSub && <p className="text-sm text-text-2">{backSub}</p>}
            <div className="mt-4 min-h-0 flex-1">{everFlipped && <OddsHistoryChart title="" series={series!} />}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                ref={backRef}
                onClick={() => setFlipped(false)}
                className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-text-3"
              >
                ← Back to the option
              </button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

/** Loads recorded YES odds for some contracts: { symbol: [{ ts, yes }] }. */
export function useOddsHistory(symbols: string[]) {
  const key = symbols.join(",");
  const [data, setData] = useState<Record<string, { ts: number; yes: number }[]> | undefined>(undefined);
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/odds/history?symbols=${encodeURIComponent(key)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((b) => setData(b.history ?? {}))
      .catch((e) => e.name !== "AbortError" && setData({}));
    return () => ctrl.abort();
  }, [key]);
  return data;
}
