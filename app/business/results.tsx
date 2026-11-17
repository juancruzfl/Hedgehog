"use client";

// The "your numbers" panels shown after picking an option: outcome table, chart, exact
// orders and approval. Shared by event hedges (promos, games) and price hedges (fuel, metals).

import { ApprovePanel } from "@/components/ApprovePanel";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import { Stat, StepHeading } from "@/components/ui";
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

export function EventResult({ sized, profile, loading }: { sized: Extract<SizeResponse, { kind: "event" }>; profile: RiskProfile; loading: boolean }) {
  const p = sized.proposal;
  const leg = p.legs[0];
  if (!leg) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">{p.summary} {p.warnings.slice(1).join(" ")}</p>;
  }
  const s = p.scenarios.find((x) => x.exposure === "expected")!;
  const exposure = profile.exposureUsd.expected;
  return (
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <StepHeading title="Your numbers" sub={`If ${lowerFirst(profile.condition)}, the market pays you. If not, you're out what you paid.`} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="You pay now" value={usd(p.totalCost)} note={`market prices it at ${pct(leg.limitPrice)}`} />
        <Stat label="If it happens, you get" value={usd(p.maxPayout)} note="paid by Gemini" />
        {Math.abs(s.ifTriggered - s.ifNotTriggered) < 1 ? (
          <Stat label="Your cost either way" value={usd(Math.abs(s.ifNotTriggered))} note={`instead of $0 or ${usd(exposure, 0)}`} />
        ) : (
          <Stat label="If it happens, you're out" value={usd(Math.abs(s.ifTriggered))} note={`instead of ${usd(exposure, 0)}`} />
        )}
      </div>

      <table className="mt-5 w-full overflow-hidden rounded-xl text-sm tabular-nums">
        <caption className="sr-only">Your net cost in each outcome</caption>
        <thead className="text-left text-xs text-text-3">
          <tr>
            <th className="pb-2 font-normal" />
            <th className="pb-2 text-right font-normal">If it happens</th>
            <th className="pb-2 text-right font-normal">If it doesn&apos;t</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <td className="py-2 text-text-2">Without Hedgehog</td>
            <td className="py-2 text-right">{usd(-exposure, 0)}</td>
            <td className="py-2 text-right">{usd(0, 0)}</td>
          </tr>
          <tr>
            <td className="py-2 font-medium">With Hedgehog</td>
            <td className="py-2 text-right font-medium">{usd(s.ifTriggered, 0)}</td>
            <td className="py-2 text-right font-medium">{usd(s.ifNotTriggered, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-3">
        If the real cost lands at the low or high estimate, your net is{" "}
        {p.scenarios.filter((x) => x.exposure !== "expected").map((x) => usd(x.ifTriggered, 0)).join(" or ")} when it happens. Costs exclude Gemini fees.
      </p>

      <details className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Exact order on Gemini</summary>
        <p className="mt-2 tabular-nums">
          Buy {qty(leg.quantity)} {leg.outcome.toUpperCase()} contracts on “{leg.contract.marketTitle}: {leg.contract.label}” at up to {usd(leg.limitPrice)} each. Each pays $1 if it resolves {leg.outcome.toUpperCase()}.
        </p>
        {leg.contract.rulesText && <p className="mt-2 text-xs text-text-3">Rules: {leg.contract.rulesText.slice(0, 400)}{leg.contract.rulesText.length > 400 ? "…" : ""}</p>}
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

export function PriceResult({ sized, loading }: { sized: Extract<SizeResponse, { kind: "price" }>; loading: boolean }) {
  const p = sized.proposal;
  const pos = sized.profile.position!;
  const rising = sized.profile.kind === "price_rise";
  if (!p.legs.length) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try a different range.</p>;
  }
  const first = p.legs[0].contract.strike!.value!;
  return (
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <StepHeading title="Your numbers" sub={`Settles ${shortDate(sized.market.expiry)}. The payout grows the further the price ${rising ? "rises" : "falls"}.`} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="You pay now" value={usd(p.totalCost)} />
        <Stat label={`Starts paying ${rising ? "above" : "below"}`} value={usd(first, first >= 20 ? 0 : 2)} note={`${pos.asset} price`} />
        <Stat label="Most you get back" value={usd(p.maxPayout)} />
      </div>
      <p className="mt-3 text-sm text-text-2 tabular-nums">
        Sized for about {qty(pos.quantity)} {unitLabel(pos.asset)} of {pos.asset}. Every $1 {rising ? "rise" : "drop"} costs you about {usd(pos.quantity, 0)}.
      </p>
      <div className="mt-5">
        <PayoffChart
          data={sized.curve}
          spot={sized.spot}
          asset={pos.asset}
          caption={`Your ${rising ? "extra cost" : "gain or loss"} at settlement compared with today's price, including what the hedge costs.`}
        />
      </div>
      <details className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Exact orders on Gemini ({p.legs.length})</summary>
        <ul className="mt-2 space-y-1 tabular-nums">
          {p.legs.map((l) => (
            <li key={l.contract.symbol}>
              Buy {qty(l.quantity)} {l.outcome.toUpperCase()} on “{l.contract.label}” at {usd(l.limitPrice)} = {usd(l.cost)}
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
