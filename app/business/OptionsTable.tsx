"use client";

// The business flow's hedge options as comparison rows (after Google Flights): one row per
// option with only what differs (what it pays on, match quality, market odds, price).
// Clicking a row opens the setup for that option right inside the row, so the numbers
// appear in exactly one place.

import { OddsHistoryChart } from "@/components/charts";
import { useOddsHistory } from "@/components/FlipCard";
import type { EventMatch } from "@/lib/business/analyze";
import { pct, shortDate, usd } from "@/lib/format";
import type { Contract, RiskProfile } from "@/lib/types";
import { plainTrigger, QualityBadge, type SizeResponse } from "./results";

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
  return { key: c.symbol + outcome, label, data: pts.map((p) => ({ ts: p.ts, probBelow: outcome === "yes" ? p.yes : 1 - p.yes })) };
}

const COLS = "md:grid-cols-[minmax(0,1fr)_9rem_8rem_7rem_1.5rem]";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 text-text-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** How an option's odds have moved, tucked into the open row. */
function OddsHistory({ contracts, outcome, label }: { contracts: Contract[]; outcome: "yes" | "no"; label: string }) {
  const hist = useOddsHistory(contracts.map((c) => c.symbol));
  const series = hist ? contracts.map((c, k) => seriesFor(c, outcome, k === 0 && contracts.length === 1 ? label : c.label, hist[c.symbol])) : null;
  const enough = series?.some((s) => s.data.length >= 3);
  return (
    <details className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">How the odds have moved</summary>
      <div className="mt-3">
        {!series ? (
          <p className="text-text-3">Loading odds history…</p>
        ) : enough ? (
          <OddsHistoryChart series={series} title="" />
        ) : (
          <p className="text-text-3">Odds history shows up after a few readings (one every 5 minutes).</p>
        )}
      </div>
    </details>
  );
}

function Row({
  open,
  onToggle,
  title,
  sub,
  match,
  odds,
  price,
  tags,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  sub: string;
  match: React.ReactNode;
  odds: string;
  price: React.ReactNode;
  tags: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-2/60 ${COLS} ${open ? "bg-surface-2/50" : ""}`}
      >
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="block truncate text-xs text-text-3">{sub}</span>
          <span className="mt-1 flex flex-wrap gap-1.5 md:hidden">{match}</span>
        </span>
        <span className="hidden md:block">{match}</span>
        <span className="hidden text-right text-sm tabular-nums text-text-2 md:block">{odds}</span>
        <span className="text-right">
          <span className="block font-semibold tabular-nums">{price}</span>
          {tags.map((t) => (
            <span key={t} className="block text-[11px] font-medium text-good">
              {t}
            </span>
          ))}
        </span>
        <span className="hidden justify-end md:flex">
          <Chevron open={open} />
        </span>
      </button>
      {open && <div className="border-t border-border bg-surface-2/40 px-5 py-5 sm:px-6">{children}</div>}
    </div>
  );
}

function Header({ first }: { first: string }) {
  return (
    <div className={`hidden gap-4 border-b border-border bg-surface-2 px-5 py-2 text-xs text-text-3 md:grid ${COLS}`}>
      <span>{first}</span>
      <span>Match</span>
      <span className="text-right">Market odds</span>
      <span className="text-right">You pay</span>
      <span />
    </div>
  );
}

/** Promo / game options: one row each. */
export function EventOptions({
  matches,
  priced,
  profile,
  open,
  onToggle,
  panel,
}: {
  matches: EventMatch[];
  priced: (SizeResponse | null | undefined)[];
  profile: RiskProfile;
  open: number | null;
  onToggle: (i: number) => void;
  /** The setup for the open row (payback choice, outcomes, approve). */
  panel: React.ReactNode;
}) {
  const costs = priced.map((p) => (p?.kind === "event" && p.proposal.legs.length ? p.proposal.totalCost : null));
  const cheapest = Math.min(...costs.filter((c): c is number => c !== null));
  const exactCount = matches.filter((m) => m.quality === "exact").length;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Header first="Pays you if" />
      {matches.map((m, i) => {
        const p = priced[i];
        const leg = p?.kind === "event" ? p.proposal.legs[0] : undefined;
        const cost = costs[i];
        const tags = [
          ...(m.quality === "exact" && exactCount === 1 && matches.length > 1 ? ["Best match"] : []),
          ...(cost !== null && cost === cheapest && matches.length > 1 ? ["Cheapest"] : []),
        ];
        const trigger = plainTrigger(m, profile);
        // Partial matches lead with the one difference that matters.
        const note = m.quality === "exact" ? null : (m.ruleMismatches[0] ?? m.rationale);
        return (
          <Row
            key={m.symbol + m.outcome}
            open={open === i}
            onToggle={() => onToggle(i)}
            title={trigger.charAt(0).toUpperCase() + trigger.slice(1)}
            sub={`Gemini: ${m.contract.marketTitle.replace(/\?$/, "")} · settles ${shortDate(m.contract.expiry)}`}
            match={<QualityBadge quality={m.quality} />}
            odds={leg ? `${pct(leg.limitPrice)} chance` : "—"}
            price={cost !== null ? usd(cost) : p === undefined ? <span className="inline-block h-4 w-12 animate-pulse rounded bg-surface-2" /> : "Not for sale"}
            tags={tags}
          >
            {note && <p className="mb-5 rounded-xl bg-warn-bg px-4 py-2.5 text-sm">{note}</p>}
            {panel}
            <OddsHistory contracts={[m.contract]} outcome={m.outcome} label={`Chance ${trigger}`} />
          </Row>
        );
      })}
    </div>
  );
}

/** A rising/falling cost: one stand-in price market, shown as a single row (open by default). */
export function PriceOption({
  title,
  notes,
  spot,
  sized,
  rising,
  open,
  onToggle,
  panel,
}: {
  title: string;
  notes: string[];
  spot: number;
  sized?: Extract<SizeResponse, { kind: "price" }> | null;
  rising: boolean;
  open: boolean;
  onToggle: () => void;
  panel: React.ReactNode;
}) {
  const p = sized?.proposal;
  const strikes = (p?.legs ?? []).map((l) => l.contract.strike!.value!);
  const first = strikes.length ? (rising ? Math.min(...strikes) : Math.max(...strikes)) : null;
  // "Oil (Brent) price on Nov 30?" -> "oil"
  const name = title.split(" price")[0].replace(/\s*\(.*?\)/, "").toLowerCase();
  const fmt = (v: number) => usd(v, v >= 20 ? 0 : 2);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Header first="Pays you if" />
      <Row
        open={open}
        onToggle={onToggle}
        title={`${name.charAt(0).toUpperCase() + name.slice(1)} ${rising ? "rises above" : "falls below"} ${first !== null ? fmt(first) : "a set price"}`}
        sub={`Gemini: ${title.replace("?", "")}`}
        match={<span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">Stand-in</span>}
        odds={`expects ~${fmt(spot)}`}
        price={p?.legs.length ? usd(p.totalCost) : sized === undefined ? <span className="inline-block h-4 w-12 animate-pulse rounded bg-surface-2" /> : "Adjust range"}
        tags={[]}
      >
        {notes.length > 0 && (
          <div className="mb-5 rounded-xl bg-warn-bg px-4 py-2.5 text-sm">
            <p>{notes[0]}</p>
            {notes.length > 1 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-medium text-warn">More about the fine print</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {notes.slice(1).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {panel}
        {p && p.legs.length > 0 && <OddsHistory contracts={p.legs.slice(0, 3).map((l) => l.contract)} outcome="yes" label="" />}
      </Row>
    </div>
  );
}
