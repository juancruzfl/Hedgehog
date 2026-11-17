"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApprovePanel } from "@/components/ApprovePanel";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import type { Analysis, EventMatch } from "@/lib/business/analyze";
import type { EventHedgeResult } from "@/lib/engine/sizer";
import { pct, qty, shortDate, usd } from "@/lib/format";
import type { ExposureRange, HedgeProposal, RiskProfile } from "@/lib/types";

const EXAMPLES = [
  {
    label: "Game-day promo",
    text: "I run a sports bar in Indianapolis. If the Colts beat Houston on Thursday night, wings are half price all night. We usually sell about 500 orders and the discount is $6 each.",
  },
  {
    label: "Fuel costs",
    text: "We run 6 delivery vans that burn about 2,500 gallons of diesel a month. A jump in fuel prices before the end of the month would wreck our margins.",
  },
  {
    label: "Cold weekend",
    text: "Our outdoor market in Austin loses about $4,000 in sales when Saturday's high is under 50°F.",
  },
  {
    label: "Metal prices",
    text: "I'm a jeweler and need to buy about 20 oz of gold for holiday inventory at the end of the month. If gold jumps, my margins disappear.",
  },
];

const STEPS = ["Understanding your risk…", "Searching Gemini markets…", "Checking the fine print…"];

type SizeResponse =
  | { kind: "event"; market: { id: string; title: string; expiry: string }; profile: RiskProfile; proposal: EventHedgeResult }
  | { kind: "price"; spot: number; market: { id: string; title: string; expiry: string }; profile: RiskProfile; proposal: HedgeProposal & { capPrice?: number; startPrice?: number }; curve: CurvePoint[] };

function QualityBadge({ quality }: { quality: EventMatch["quality"] }) {
  return quality === "exact" ? (
    <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">Exact match</span>
  ) : (
    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">Partial match</span>
  );
}

export function BusinessFlow() {
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("q") ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [choice, setChoice] = useState(0);

  // sizing controls
  const [sizeTo, setSizeTo] = useState<keyof ExposureRange>("expected");
  const [hedgeRatio, setHedgeRatio] = useState(1);
  const [startMove, setStartMove] = useState(0.03);
  const [capMove, setCapMove] = useState(0.25);
  const [sized, setSized] = useState<SizeResponse | null>(null);
  const [sizing, setSizing] = useState(false);

  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    return () => clearInterval(t);
  }, [analyzing]);

  async function analyze() {
    setAnalyzing(true);
    setStep(0);
    setError(null);
    setAnalysis(null);
    setSized(null);
    setChoice(0);
    try {
      const res = await fetch("/api/business/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setProfile(body.profile);
      setFollowUps(body.followUps);
      setAnalysis(body.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  // Re-size (deterministic, no AI) whenever the choice or controls change.
  useEffect(() => {
    if (!profile || !analysis || analysis.type === "none") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSizing(true);
      const m = analysis.type === "event" ? analysis.matches[choice] : null;
      const payload =
        analysis.type === "event"
          ? { profile, marketId: m!.contract.marketId, symbol: m!.contract.symbol, outcome: m!.outcome, sizeTo, hedgeRatio }
          : { profile, marketId: analysis.marketId, startMove, capMove };
      try {
        const res = await fetch("/api/business/size", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        setSized(body);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setSizing(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [profile, analysis, choice, sizeTo, hedgeRatio, startMove, capMove]);

  function setExpected(v: number) {
    if (!profile || !(v >= 0)) return;
    const r = profile.exposureUsd;
    const scale = r.expected > 0 ? v / r.expected : 1;
    setProfile({ ...profile, exposureUsd: { low: r.low * scale, expected: v, high: r.high * scale } });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <label htmlFor="risk" className="text-lg font-semibold">What could hurt your business?</label>
        <p className="mt-1 text-sm text-text-2">Describe it like you would to a friend: what happens, when, and roughly what it would cost you.</p>
        <textarea
          id="risk"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. If the Colts win Thursday, wings are half price. That's about 500 orders at $6 off."
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} onClick={() => setText(ex.text)} className="rounded-full border border-border px-3 py-1 text-xs text-text-2 hover:border-accent hover:text-accent">
              {ex.label}
            </button>
          ))}
        </div>
        <button onClick={analyze} disabled={analyzing || text.trim().length < 10} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
          {analyzing ? STEPS[step] : "Find ways to reduce it"}
        </button>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </section>

      {profile && analysis && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">What we understood</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-3">The risk</dt>
              <dd className="mt-0.5 font-medium">{profile.condition}</dd>
            </div>
            <div>
              <dt className="text-text-3">When</dt>
              <dd className="mt-0.5 font-medium">
                {shortDate(profile.window.start)}
                {shortDate(profile.window.end) !== shortDate(profile.window.start) && ` – ${shortDate(profile.window.end)}`}
              </dd>
            </div>
            {profile.position ? (
              <div>
                <dt className="text-text-3">How much you&apos;re exposed to</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={Math.round(profile.position.quantity)}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      if (q >= 0) setProfile({ ...profile, position: { ...profile.position!, quantity: q } });
                    }}
                    className="w-28 rounded-md border border-border bg-background px-2 py-1 font-medium tabular-nums"
                    aria-label={`Units of ${profile.position.asset} you're exposed to`}
                  />
                  <span className="text-xs text-text-3">{unitLabel(profile.position.asset)}</span>
                </dd>
              </div>
            ) : (
              <div>
                <dt className="text-text-3">Cost to you if it happens</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <span className="text-text-3">$</span>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(profile.exposureUsd.expected)}
                    onChange={(e) => setExpected(Number(e.target.value))}
                    className="w-28 rounded-md border border-border bg-background px-2 py-1 font-medium tabular-nums"
                    aria-label="Expected cost if it happens"
                  />
                  <span className="text-xs text-text-3 tabular-nums">
                    ({usd(profile.exposureUsd.low, 0)}–{usd(profile.exposureUsd.high, 0)})
                  </span>
                </dd>
              </div>
            )}
          </dl>
          {profile.notes && <p className="mt-3 text-xs text-text-3">Assumptions: {profile.notes}</p>}
          {followUps.length > 0 && (
            <div className="mt-3 rounded-lg bg-warn-bg p-3 text-sm">
              <p className="font-medium">To make this more accurate, add to your description:</p>
              <ul className="mt-1 list-disc pl-5">{followUps.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {analysis?.type === "none" && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">No good match on Gemini right now</h2>
          <p className="mt-1 text-sm text-text-2">{analysis.reason}</p>
          <p className="mt-2 text-sm text-text-2">
            Gemini currently lists sports, daily high temperatures in about 50 US cities, oil, natural gas, metals, and major crypto prices.
          </p>
        </section>
      )}

      {analysis?.type === "event" && profile && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">The market that offsets it</h2>
          <div className="mt-3 space-y-2">
            {analysis.matches.map((m, i) => (
              <label key={m.symbol + m.outcome} className={`block cursor-pointer rounded-xl border p-3 text-sm ${i === choice ? "border-accent" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="match" checked={i === choice} onChange={() => setChoice(i)} />
                  <span className="font-medium">{m.contract.marketTitle}: {m.contract.label}</span>
                  <span className="text-text-3">buy {m.outcome.toUpperCase()}</span>
                  <QualityBadge quality={m.quality} />
                </div>
                <p className="mt-1 pl-6 text-text-2">{m.rationale}</p>
                {i === choice && m.ruleMismatches.length > 0 && (
                  <div className="mt-2 ml-6 rounded-lg bg-warn-bg p-2">
                    <p className="text-xs font-medium">Fine print to know</p>
                    <ul className="mt-0.5 list-disc pl-5 text-xs">{m.ruleMismatches.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="text-sm">
              <span className="text-text-2">Size it for</span>
              <div className="mt-1 flex gap-1 rounded-lg bg-background p-1">
                {(["low", "expected", "high"] as const).map((k) => (
                  <button key={k} onClick={() => setSizeTo(k)} className={`flex-1 rounded-md px-2 py-1 ${sizeTo === k ? "bg-surface font-medium shadow-sm" : "text-text-2"}`}>
                    {k === "expected" ? "Expected" : k === "low" ? "Low estimate" : "High estimate"} ({usd(profile.exposureUsd[k], 0)})
                  </button>
                ))}
              </div>
            </div>
            <label className="text-sm">
              <span className="text-text-2">Offset <b className="text-text">{Math.round(hedgeRatio * 100)}%</b> of it</span>
              <input type="range" min={0.25} max={1} step={0.05} value={hedgeRatio} onChange={(e) => setHedgeRatio(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
            </label>
          </div>

          {sized?.kind === "event" && <EventResult sized={sized} profile={profile} loading={sizing} />}
        </section>
      )}

      {analysis?.type === "price" && profile && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">The market that offsets it</h2>
          <p className="mt-1 text-sm text-text-2">
            {analysis.marketTitle.replace("?", "")} · market-implied price about {usd(analysis.spot)}
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-text-3">{analysis.notes.map((n) => <li key={n}>{n}</li>)}</ul>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-text-2">Start after a {profile.kind === "price_rise" ? "rise" : "drop"} of <b className="text-text">{Math.round(startMove * 100)}%</b></span>
              <input type="range" min={0} max={0.15} step={0.01} value={startMove} onChange={(e) => setStartMove(Math.min(Number(e.target.value), capMove - 0.05))} className="mt-3 w-full accent-[var(--accent)]" />
            </label>
            <label className="text-sm">
              <span className="text-text-2">Offset up to a <b className="text-text">{Math.round(capMove * 100)}%</b> move</span>
              <input type="range" min={0.1} max={0.5} step={0.01} value={capMove} onChange={(e) => setCapMove(Math.max(Number(e.target.value), startMove + 0.05))} className="mt-3 w-full accent-[var(--accent)]" />
            </label>
          </div>

          {sized?.kind === "price" && <PriceResult sized={sized} loading={sizing} />}
        </section>
      )}
    </div>
  );
}

const UNITS: Record<string, string> = { WTI: "barrels", BRENT: "barrels", "NATURAL GAS": "MMBtu", GOLD: "troy oz", SILVER: "troy oz", COPPER: "lb" };
const unitLabel = (asset: string) => UNITS[asset.toUpperCase()] ?? asset;

/** "The Colts beat Houston." -> "the Colts beat Houston" (keeps proper nouns). */
const lowerFirst = (s: string) => s.replace(/\.$/, "").replace(/^(The|A|An|Our|My|We|It|If)\b/, (w) => w.toLowerCase());

function EventResult({ sized, profile, loading }: { sized: Extract<SizeResponse, { kind: "event" }>; profile: RiskProfile; loading: boolean }) {
  const p = sized.proposal;
  const leg = p.legs[0];
  if (!leg) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">{p.summary} {p.warnings.slice(1).join(" ")}</p>;
  }
  const s = p.scenarios.find((x) => x.exposure === "expected")!;
  const exposure = profile.exposureUsd.expected;
  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      <p className="mt-6 text-xl font-semibold leading-snug tabular-nums">
        Pay {usd(p.totalCost)} now. If {lowerFirst(profile.condition)}, you get {usd(p.maxPayout)}.
      </p>
      <p className="mt-1 text-sm text-text-2">
        The market prices this at {pct(leg.limitPrice)}. Hedging turns an uncertain {usd(exposure, 0)} hit into a known {usd(p.totalCost, 0)} cost.
      </p>

      <table className="mt-5 w-full text-sm tabular-nums">
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

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-text-2">Exact order on Gemini</summary>
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

function PriceResult({ sized, loading }: { sized: Extract<SizeResponse, { kind: "price" }>; loading: boolean }) {
  const p = sized.proposal;
  const pos = sized.profile.position!;
  const rising = sized.profile.kind === "price_rise";
  if (!p.legs.length) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try a different range.</p>;
  }
  const first = p.legs[0].contract.strike!.value!;
  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      <p className="mt-6 text-xl font-semibold leading-snug tabular-nums">
        Pay {usd(p.totalCost)} now. If the price {rising ? "rises above" : "falls below"} {usd(first)} by {shortDate(sized.market.expiry)}, you get back up to {usd(p.maxPayout)}.
      </p>
      <p className="mt-1 text-sm text-text-2 tabular-nums">
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
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-text-2">Exact orders on Gemini ({p.legs.length})</summary>
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
