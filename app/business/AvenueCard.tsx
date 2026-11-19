"use client";

import { FlipCard, useOddsHistory } from "@/components/FlipCard";
import type { EventMatch } from "@/lib/business/analyze";
import { shortDate, usd } from "@/lib/format";
import type { Contract, RiskProfile } from "@/lib/types";

/** Mid of the YES price right now (or whichever side exists). */
function yesNow(c: Contract): number | null {
  const q = c.quote;
  if (q.yesBid !== null && q.yesAsk !== null) return (q.yesBid + q.yesAsk) / 2;
  return q.yesAsk ?? q.yesBid ?? q.last ?? null;
}

/** Recorded odds plus a reading for right now, as the chance of `outcome`. */
function seriesFor(c: Contract, outcome: "yes" | "no", label: string, hist: { ts: number; yes: number }[] | undefined) {
  const now = yesNow(c);
  const pts = [...(hist ?? []), ...(now === null ? [] : [{ ts: Date.now(), yes: now }])];
  return {
    key: c.symbol + outcome,
    label,
    data: pts.map((p) => ({
      ts: p.ts,
      probBelow: outcome === "yes" ? p.yes : 1 - p.yes,
    })),
  };
}
import { plainTrigger, QualityBadge, type SizeResponse } from "./results";

/** One hedging option for an event risk: why it fits, the fine print, and its numbers. */
export function EventAvenueCard({
  m,
  i,
  n,
  sized,
  profile,
  onUse,
}: {
  m: EventMatch;
  i: number;
  n: number;
  sized?: Extract<SizeResponse, { kind: "event" }> | null;
  profile: RiskProfile;
  onUse: () => void;
}) {
  const p = sized?.proposal;
  const leg = p?.legs[0];
  const s = p?.scenarios.find((x) => x.exposure === "expected");
  const hist = useOddsHistory([m.contract.symbol]);
  const happens = m.outcome === "yes" ? "happens" : "doesn't happen";
  const trigger = plainTrigger(m, profile);
  const evenCost = s && Math.abs(s.ifTriggered - s.ifNotTriggered) < 1;
  // Partial matches lead with the one difference that matters; the rest is a click away.
  const [firstNote, ...moreNotes] = m.quality === "exact" ? [] : m.ruleMismatches.length ? m.ruleMismatches : [m.rationale];
  return (
    <FlipCard
      series={hist && [seriesFor(m.contract, m.outcome, `Chance it ${happens}`, hist[m.contract.symbol])]}
      backTitle={`${m.contract.marketTitle}: ${m.contract.label} · how the odds have moved`}
      backSub={`Chance it ${happens}, as priced on Gemini`}
      footer={
        <button
          onClick={onUse}
          disabled={!leg}
          className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          Use this option →
        </button>
      }
      front={
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
            <QualityBadge quality={m.quality} />
            {n > 1 && (
              <span>
                Option {i + 1} of {n}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-snug">Pays you if {trigger}</h2>
          <p className="text-xs text-text-3">
            Gemini market: {m.contract.marketTitle.replace(/\?$/, "")} · {m.contract.label} · settles {shortDate(m.contract.expiry)}
          </p>

          {firstNote && (
            <div className="mt-3 rounded-xl bg-warn-bg px-4 py-2.5 text-sm">
              <p>{firstNote}</p>
              {moreNotes.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-warn">More about the fine print</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {moreNotes.slice(0, 3).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="mt-4">
            {p && leg && s ? (
              <>
                <p className="text-lg leading-snug">
                  <b className="font-semibold">Pay {usd(p.totalCost)}</b> → get <b className="font-semibold text-good">{usd(p.maxPayout)}</b> back if {trigger}
                </p>
                <p className="mt-2 inline-block rounded-full bg-good-soft px-3 py-1 text-sm font-medium text-good">
                  {evenCost
                    ? `Your cost is ${usd(Math.abs(s.ifNotTriggered))} either way`
                    : `If it happens, you're out ${usd(Math.abs(s.ifTriggered))} instead of ${usd(profile.exposureUsd.expected, 0)}`}
                </p>
              </>
            ) : sized === null ? (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-2">No one is selling this outcome right now, so it can&apos;t be priced.</p>
            ) : (
              <div className="space-y-2">
                <div className="h-6 w-3/4 animate-pulse rounded bg-surface-2" />
                <div className="h-7 w-1/2 animate-pulse rounded-full bg-surface-2" />
              </div>
            )}
          </div>
        </>
      }
    />
  );
}

/** The single option for a rising/falling cost: a price market used as a stand-in. */
export function PriceAvenueCard({
  title,
  notes,
  spot,
  sized,
  onUse,
}: {
  title: string;
  notes: string[];
  spot: number;
  sized?: Extract<SizeResponse, { kind: "price" }> | null;
  onUse: () => void;
}) {
  const p = sized?.proposal;
  const rising = sized?.profile.kind !== "price_drop";
  const first = p?.legs[0]?.contract.strike?.value ?? null;
  // "Oil (Brent) price on Nov 30?" -> "oil"
  const name = title.split(" price")[0].replace(/\s*\(.*?\)/, "").toLowerCase();
  // The price levels this hedge would use (max 3 lines on the chart).
  const levels = (p?.legs ?? []).slice(0, 3).map((l) => l.contract);
  const hist = useOddsHistory(levels.map((c) => c.symbol));
  return (
    <FlipCard
      series={
        levels.length && hist
          ? levels.map((c) => seriesFor(c, "yes", c.label, hist[c.symbol]))
          : sized === undefined || (levels.length && !hist)
            ? undefined
            : []
      }
      backTitle={`${title.replace("?", "")} · how the odds have moved`}
      backSub="Chance it ends past each price level this hedge uses"
      footer={
        <button onClick={onUse} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
          Use this option →
        </button>
      }
      front={
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
            <span className="rounded-full bg-warn-bg px-2 py-0.5 font-medium text-warn">Stand-in for your cost</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-snug">
            Pays you if {name} {rising ? "rises above" : "falls below"} {first !== null ? usd(first, first >= 20 ? 0 : 2) : "a set price"}
          </h2>
          <p className="text-xs text-text-3">
            Gemini market: {title.replace("?", "")} · market expects about {usd(spot, spot >= 20 ? 0 : 2)}
          </p>
          {notes.length > 0 && (
            <div className="mt-3 rounded-xl bg-warn-bg px-4 py-2.5 text-sm">
              <p>{notes[0]}</p>
              {notes.length > 1 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-warn">More about the fine print</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {notes.slice(1).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="mt-4">
            {p && p.legs.length && first !== null ? (
              <p className="text-lg leading-snug">
                <b className="font-semibold">Pay {usd(p.totalCost)}</b> → get up to <b className="font-semibold text-good">{usd(p.maxPayout)}</b> back, more the further it{" "}
                {rising ? "rises" : "falls"}
              </p>
            ) : sized === null || (p && !p.legs.length) ? (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-2">No prices in the default range. Adjust it after choosing this option.</p>
            ) : (
              <div className="h-6 w-3/4 animate-pulse rounded bg-surface-2" />
            )}
          </div>
        </>
      }
    />
  );
}
