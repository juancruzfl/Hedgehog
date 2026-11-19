"use client";

// The "your numbers" panels shown after picking an option: outcome table, chart, exact
// orders and approval. Shared by event hedges (promos, games) and price hedges (fuel, metals).

import { ApprovePanel } from "@/components/ApprovePanel";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import { WhatIf } from "@/components/HedgeControls";
import type { EventMatch } from "@/lib/business/analyze";
import type { EventHedgeResult } from "@/lib/engine/sizer";
import { pct, qty, shortDate, usd } from "@/lib/format";
import type { HedgeProposal, RiskProfile } from "@/lib/types";

export type SizeResponse =
  | { kind: "event"; market: { id: string; title: string; expiry: string }; profile: RiskProfile; proposal: EventHedgeResult }
  | {
      kind: "price";
      spot: number;
      market: { id: string; title: string; expiry: string };
      profile: RiskProfile;
      proposal: HedgeProposal & { capPrice?: number; startPrice?: number };
      curve: CurvePoint[];
    };

export function QualityBadge({ quality }: { quality: EventMatch["quality"] }) {
  return quality === "exact" ? (
    <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good">Exact match</span>
  ) : (
    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">Partial match</span>
  );
}

const UNITS: Record<string, string> = { WTI: "barrels", BRENT: "barrels", "NATURAL GAS": "MMBtu", GOLD: "troy oz", SILVER: "troy oz", COPPER: "lb" };
export const unitLabel = (asset: string) => UNITS[asset.toUpperCase()] ?? asset;

/** "The Colts beat Houston." -> "the Colts beat Houston" (keeps proper nouns). */
export const lowerFirst = (s: string) => s.replace(/\.$/, "").replace(/^(The|A|An|Our|My|We|It|If)\b/, (w) => w.toLowerCase());

/**
 * What makes this option pay, in plain words. Exact matches reuse the user's own wording
 * ("the Colts win"); partial ones are described from the contract itself.
 */
export function plainTrigger(m: EventMatch, profile: RiskProfile): string {
  if (m.quality === "exact") return lowerFirst(profile.condition);
  const c = m.contract;
  const yes = m.outcome === "yes";
  if (c.category === "Weather") return `the high ${yes ? "is" : "isn't"} ${c.label}`;
  if (c.category === "Sports" && /-M$/.test(c.marketId)) return `${c.label} ${yes ? "wins" : "doesn't win"}`;
  // Gemini's contract labels read as statements ("Indianapolis scores more than 20.5 points").
  return yes ? c.label : `this doesn't happen: “${c.label}”`;
}

export function EventResult({
  sized,
  profile,
  loading,
  trigger,
}: {
  sized: Extract<SizeResponse, { kind: "event" }>;
  profile: RiskProfile;
  loading: boolean;
  /** Plain words for what makes it pay, e.g. "the Colts win". */
  trigger: string;
}) {
  const p = sized.proposal;
  const leg = p.legs[0];
  if (!leg) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">{p.summary} {p.warnings.slice(1).join(" ")}</p>;
  }
  const s = p.scenarios.find((x) => x.exposure === "expected")!;
  const exposure = profile.exposureUsd.expected;
  const money = (n: number) => (n < -0.5 ? `−${usd(-n, 0)}` : usd(Math.max(0, n), 0));
  const Outcome = ({ title, without, withHedge }: { title: string; without: number; withHedge: number }) => (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 flex items-baseline justify-between text-sm tabular-nums">
        <span className="text-text-2">Without a hedge</span>
        <span className={without < -0.5 ? "text-bad" : ""}>{money(without)}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between rounded-lg bg-accent-soft px-2 py-1.5 tabular-nums">
        <span className="text-sm font-medium">With the hedge</span>
        <span className={`text-lg font-semibold ${withHedge < -0.5 ? "text-bad" : withHedge > 0.5 ? "text-good" : ""}`}>{money(withHedge)}</span>
      </div>
    </div>
  );
  return (
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <p className="text-xl leading-snug sm:text-2xl">
        <b className="font-semibold">Pay {usd(p.totalCost)} now.</b> If {trigger}, you get back <b className="font-semibold text-good">{usd(p.maxPayout)}</b>.
      </p>
      <p className="mt-1 text-sm text-text-3">Gemini&apos;s market gives it about a {pct(leg.limitPrice)} chance, which is why it costs what it does.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Outcome title={`If ${trigger}`} without={-exposure} withHedge={s.ifTriggered} />
        <Outcome title="If it doesn't" without={0} withHedge={s.ifNotTriggered} />
      </div>
      <p className="mt-2 text-xs text-text-3">Based on your expected cost of {usd(exposure, 0)}. Gemini&apos;s trading fees aren&apos;t included.</p>

      <details className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Details: the exact order and the market&apos;s rules</summary>
        <p className="mt-2 tabular-nums">
          Buy {qty(leg.quantity)} {leg.outcome.toUpperCase()} contracts on &ldquo;{leg.contract.marketTitle}: {leg.contract.label}&rdquo; at up to {usd(leg.limitPrice)} each.
          Each pays $1 if it resolves {leg.outcome.toUpperCase()}.
        </p>
        {leg.contract.rulesText && (
          <p className="mt-2 text-xs text-text-3">
            Rules: {leg.contract.rulesText.slice(0, 400)}
            {leg.contract.rulesText.length > 400 ? "…" : ""}
          </p>
        )}
      </details>

      <ApprovePanel
        legs={p.legs.map((l) => ({ marketId: l.contract.marketId, symbol: l.contract.symbol, outcome: l.outcome, quantity: l.quantity, limitPrice: l.limitPrice }))}
        totalCost={p.totalCost}
        title={`${profile.condition} (${shortDate(profile.window.end)})`}
        segment="business"
        profile={profile}
        successTitle="Hedge placed"
      />
    </div>
  );
}

/** "a, b or c" */
const listOf = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);

export function PriceResult({ sized, loading }: { sized: Extract<SizeResponse, { kind: "price" }>; loading: boolean }) {
  const p = sized.proposal;
  const pos = sized.profile.position!;
  const rising = sized.profile.kind === "price_rise";
  if (!p.legs.length) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try a different range.</p>;
  }
  const strikes = p.legs.map((l) => l.contract.strike!.value!);
  const first = rising ? Math.min(...strikes) : Math.max(...strikes);
  const last = rising ? Math.max(...strikes) : Math.min(...strikes);
  const name = sized.market.title.split(" price")[0].replace(/\s*\(.*?\)/, "");
  const fmt = (v: number) => usd(v, v >= 20 ? 0 : 2);
  const date = shortDate(sized.market.expiry);
  const single = first === last;
  const gap = Math.abs(first / sized.spot - 1);
  const uncovered = [
    ...(gap >= 0.01 ? [`the first ${pct(gap)} of a ${rising ? "rise" : "drop"}`] : []),
    ...(single ? [] : [`anything ${rising ? "above" : "below"} ${fmt(last)}`]),
    "Gemini's trading fees",
  ];
  const units = pos.quantity >= 10 ? Math.round(pos.quantity).toLocaleString("en-US") : qty(pos.quantity);
  return (
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <p className="text-xl leading-snug sm:text-2xl">
        <b className="font-semibold">Pay {usd(p.totalCost)} now.</b> If {name.toLowerCase()} {rising ? "rises above" : "falls below"}{" "}
        <b className="font-semibold">{fmt(first)}</b> by <b className="font-semibold">{date}</b>, you get back{single ? "" : " up to"}{" "}
        <b className="font-semibold text-good">{usd(p.maxPayout)}</b>.
      </p>
      <p className="mt-1 text-sm text-text-3 tabular-nums">
        Sized for about {units} {unitLabel(pos.asset)}: every $1 {rising ? "rise" : "drop"} costs you about {usd(pos.quantity, 0)}.
      </p>

      <WhatIf
        curve={sized.curve}
        spot={sized.spot}
        asset={name.toLowerCase()}
        payFrom={first}
        // One level pays a fixed amount from there on, so the band runs to the end of the track.
        payTo={single ? (rising ? sized.curve.at(-1)!.price : sized.curve[0].price) : last}
        date={date}
        rising={rising}
      />

      <p className="mt-3 text-sm text-text-2">
        {single ? (
          <>
            Pays a fixed {usd(p.maxPayout)} if {name.toLowerCase()} ends {rising ? "above" : "below"} {fmt(first)}; it doesn&apos;t grow past that.
          </>
        ) : (
          <>
            Pays for {rising ? "rises" : "drops"} between {fmt(first)} and {fmt(last)}.
          </>
        )}{" "}
        It won&apos;t cover {listOf(uncovered)}. It tracks the market price, not your exact bill.
      </p>

      <details className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">For traders: payoff chart and exact orders</summary>
        <div className="mt-3">
          <PayoffChart
            data={sized.curve}
            spot={sized.spot}
            asset={pos.asset}
            caption={`Your ${rising ? "extra cost" : "gain or loss"} at settlement compared with today's price, including what the hedge costs.`}
          />
        </div>
        <ul className="mt-3 space-y-1 tabular-nums">
          {p.legs.map((l) => (
            <li key={l.contract.symbol}>
              Buy {qty(l.quantity)} {l.outcome.toUpperCase()} on &ldquo;{l.contract.label}&rdquo; at {usd(l.limitPrice)} = {usd(l.cost)}
            </li>
          ))}
        </ul>
      </details>

      <ApprovePanel
        legs={p.legs.map((l) => ({ marketId: l.contract.marketId, symbol: l.contract.symbol, outcome: l.outcome, quantity: l.quantity, limitPrice: l.limitPrice }))}
        totalCost={p.totalCost}
        title={`${sized.profile.condition} (through ${shortDate(sized.market.expiry)})`}
        segment="business"
        profile={sized.profile}
        successTitle="Hedge placed"
      />
    </div>
  );
}
