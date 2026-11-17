"use client";

import { Stat } from "@/components/ui";
import type { EventMatch } from "@/lib/business/analyze";
import { pct, shortDate, usd } from "@/lib/format";
import type { RiskProfile } from "@/lib/types";
import { QualityBadge, type SizeResponse } from "./results";

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
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
        <span>
          Option {i + 1} of {n}
        </span>
        <QualityBadge quality={m.quality} />
      </div>
      <h2 className="mt-2 text-xl font-bold leading-snug">
        {m.contract.marketTitle}: {m.contract.label}
      </h2>
      <p className="text-sm text-text-2">
        Pays $1 per contract if it {m.outcome === "yes" ? "happens" : "doesn't happen"} · settles {shortDate(m.contract.expiry)}
      </p>

      <div className="mt-4">
        <p className="text-sm font-semibold">Why it fits</p>
        <p className="mt-0.5 text-[15px] text-text-2">{m.rationale}</p>
      </div>

      {m.ruleMismatches.length > 0 && (
        <div className="mt-3 rounded-xl bg-warn-bg px-4 py-3">
          <p className="text-sm font-semibold">Fine print to know</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {m.ruleMismatches.slice(0, 3).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {p && leg && s ? (
          <>
            <Stat label="You pay now" value={usd(p.totalCost)} note={`priced at ${pct(leg.limitPrice)}`} />
            <Stat label="If it happens, you get" value={usd(p.maxPayout)} />
            {Math.abs(s.ifTriggered - s.ifNotTriggered) < 1 ? (
              <Stat label="Your cost either way" value={usd(Math.abs(s.ifNotTriggered))} note={`instead of $0 or ${usd(profile.exposureUsd.expected, 0)}`} />
            ) : (
              <Stat label="If it happens, you're out" value={usd(Math.abs(s.ifTriggered))} note={`instead of ${usd(profile.exposureUsd.expected, 0)}`} />
            )}
          </>
        ) : sized === null ? (
          <p className="col-span-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-2">No one is selling this outcome right now, so it can&apos;t be priced.</p>
        ) : (
          [0, 1, 2].map((k) => <div key={k} className="h-[76px] animate-pulse rounded-xl bg-surface-2" />)
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          onClick={onUse}
          disabled={!leg}
          className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          Use this option →
        </button>
        <span className="text-xs text-text-3">You&apos;ll adjust the size and review everything before anything is placed.</span>
      </div>
    </article>
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
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
        <span>Option 1 of 1</span>
        <span className="rounded-full bg-warn-bg px-2 py-0.5 font-medium text-warn">Stand-in for your cost</span>
      </div>
      <h2 className="mt-2 text-xl font-bold leading-snug">{title.replace("?", "")}</h2>
      <p className="text-sm text-text-2">Market expects about {usd(spot, spot >= 20 ? 0 : 2)}</p>
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-text-2">
        {notes.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {p && p.legs.length && first !== null ? (
          <>
            <Stat label="You pay now" value={usd(p.totalCost)} />
            <Stat label={`Starts paying ${rising ? "above" : "below"}`} value={usd(first, first >= 20 ? 0 : 2)} />
            <Stat label="Most you get back" value={usd(p.maxPayout)} />
          </>
        ) : sized === null || (p && !p.legs.length) ? (
          <p className="col-span-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-2">No prices in the default range. Adjust it after choosing this option.</p>
        ) : (
          [0, 1, 2].map((k) => <div key={k} className="h-[76px] animate-pulse rounded-xl bg-surface-2" />)
        )}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <button onClick={onUse} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
          Use this option →
        </button>
      </div>
    </article>
  );
}
