"use client";

import { useSearchParams } from "next/navigation";
import { BUSINESS_EXAMPLES } from "@/lib/business/examples";
import { useEffect, useRef, useState } from "react";
import { ApprovePanel } from "@/components/ApprovePanel";
import { PayoffChart, type CurvePoint } from "@/components/charts";
import { Segmented, Stat, StepHeading } from "@/components/ui";
import type { Analysis, EventMatch } from "@/lib/business/analyze";
import type { EventHedgeResult } from "@/lib/engine/sizer";
import { pct, qty, shortDate, usd } from "@/lib/format";
import type { ExposureRange, HedgeProposal, RiskProfile } from "@/lib/types";

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

export function BusinessFlow({ examples = BUSINESS_EXAMPLES }: { examples?: { label: string; text: string }[] }) {
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

  // Arriving from the landing page with ?auto=1 runs the analysis straight away (once).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || params.get("auto") !== "1" || text.trim().length < 10) return;
    autoRan.current = true;
    void analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <StepHeading n={1} title="What's the risk?" sub="Describe it like you'd tell a friend: what happens, when, and roughly what it would cost you." />
        <textarea
          id="risk"
          aria-label="Describe the risk"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. If the home team wins Sunday, wings are half price. That's about 500 orders at $6 off."
          className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-accent"
        />
        <p className="mt-1 text-xs text-text-3">Rough numbers are fine. Leave out anything confidential.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-3">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setText(ex.text)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-text-2 hover:border-accent hover:text-accent"
            >
              {ex.label}
            </button>
          ))}
        </div>
        <button
          onClick={analyze}
          disabled={analyzing || text.trim().length < 10}
          className="mt-5 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          {analyzing ? STEPS[step] : "Find a market →"}
        </button>
        {error && <p className="mt-3 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
      </section>

      {profile && analysis && (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <StepHeading n={2} title="Here's what we understood" sub="Fix anything that's off. The numbers below update as you type." />
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <dt className="text-text-3">The risk</dt>
              <dd className="mt-0.5 font-medium">{profile.condition}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <dt className="text-text-3">When</dt>
              <dd className="mt-0.5 font-medium">
                {shortDate(profile.window.start)}
                {shortDate(profile.window.end) !== shortDate(profile.window.start) && ` – ${shortDate(profile.window.end)}`}
              </dd>
            </div>
            {profile.position ? (
              <div className="rounded-xl bg-surface-2 px-4 py-3">
                <dt className="text-text-3">How much you buy</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={Math.round(profile.position.quantity)}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      if (q >= 0) setProfile({ ...profile, position: { ...profile.position!, quantity: q } });
                    }}
                    className="w-28 rounded-lg border border-border bg-surface px-2 py-1 font-medium tabular-nums outline-none focus:border-accent"
                    aria-label={`Units of ${profile.position.asset} you're exposed to`}
                  />
                  <span className="text-xs text-text-3">{unitLabel(profile.position.asset)}</span>
                </dd>
              </div>
            ) : (
              <div className="rounded-xl bg-surface-2 px-4 py-3">
                <dt className="text-text-3">What it would cost you</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <span className="text-text-3">$</span>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(profile.exposureUsd.expected)}
                    onChange={(e) => setExpected(Number(e.target.value))}
                    className="w-28 rounded-lg border border-border bg-surface px-2 py-1 font-medium tabular-nums outline-none focus:border-accent"
                    aria-label="Expected cost if it happens"
                  />
                  <span className="text-xs text-text-3 tabular-nums">
                    ({usd(profile.exposureUsd.low, 0)}–{usd(profile.exposureUsd.high, 0)})
                  </span>
                </dd>
              </div>
            )}
          </dl>
          {profile.notes && <p className="mt-3 text-xs text-text-3">What we assumed: {profile.notes}</p>}
          {followUps.length > 0 && (
            <div className="mt-3 rounded-xl bg-warn-bg p-4 text-sm">
              <p className="font-medium">To make this more accurate, add to your description:</p>
              <ul className="mt-1 list-disc pl-5">{followUps.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {analysis?.type === "none" && (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <StepHeading n={3} title="No good match on Gemini right now" />
          <p className="mt-1 text-sm text-text-2">{analysis.reason}</p>
          <p className="mt-2 text-sm text-text-2">
            Gemini currently lists sports, daily high temperatures in about 50 US cities, oil, natural gas, metals, and major crypto prices.
          </p>
        </section>
      )}

      {analysis?.type === "event" && profile && (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <StepHeading n={3} title="The market that pays out" sub="Picked from live Gemini markets. Choose the one that best matches your risk." />
          <div className="mt-4 space-y-2">
            {analysis.matches.map((m, i) => (
              <label key={m.symbol + m.outcome} className={`block cursor-pointer rounded-xl border p-4 text-sm transition ${i === choice ? "border-accent bg-accent-soft/40" : "border-border hover:border-text-3"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="match" checked={i === choice} onChange={() => setChoice(i)} />
                  <span className="font-medium">{m.contract.marketTitle}: {m.contract.label}</span>
                  <span className="text-text-3">pays if {m.outcome === "yes" ? "it happens" : "it doesn't"}</span>
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

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="text-sm">
              <p className="mb-2 font-semibold">Size it for</p>
              <Segmented
                label="Size it for"
                value={sizeTo}
                onChange={setSizeTo}
                options={(["low", "expected", "high"] as const).map((k) => ({
                  value: k,
                  label: k === "expected" ? "Expected" : k === "low" ? "Low" : "High",
                  sub: usd(profile.exposureUsd[k], 0),
                }))}
              />
            </div>
            <label className="text-sm">
              <span className="font-semibold">How much to offset: {Math.round(hedgeRatio * 100)}%</span>
              <input type="range" min={0.25} max={1} step={0.05} value={hedgeRatio} onChange={(e) => setHedgeRatio(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
            </label>
          </div>

          {sized?.kind === "event" && <EventResult sized={sized} profile={profile} loading={sizing} />}
        </section>
      )}

      {analysis?.type === "price" && profile && (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <StepHeading n={3} title="The market that pays out" sub="A live Gemini price market that moves with your cost." />
          <div className="mt-4 rounded-xl border border-border p-4 text-sm">
            <p className="font-semibold">{analysis.marketTitle.replace("?", "")}</p>
            <p className="text-text-2">Market expects about {usd(analysis.spot)}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-text-3">{analysis.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold">Start paying after a {Math.round(startMove * 100)}% {profile.kind === "price_rise" ? "rise" : "drop"}</span>
              <input type="range" min={0} max={0.15} step={0.01} value={startMove} onChange={(e) => setStartMove(Math.min(Number(e.target.value), capMove - 0.05))} className="mt-3 w-full accent-[var(--accent)]" />
            </label>
            <label className="text-sm">
              <span className="font-semibold">Keep paying up to a {Math.round(capMove * 100)}% move</span>
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
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <StepHeading n={4} title="Your numbers" sub={`If ${lowerFirst(profile.condition)}, the market pays you. If not, you're out what you paid.`} />
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

function PriceResult({ sized, loading }: { sized: Extract<SizeResponse, { kind: "price" }>; loading: boolean }) {
  const p = sized.proposal;
  const pos = sized.profile.position!;
  const rising = sized.profile.kind === "price_rise";
  if (!p.legs.length) {
    return <p className="mt-5 rounded-lg bg-warn-bg p-3 text-sm">Gemini doesn&apos;t list prices in that range for this date. Try a different range.</p>;
  }
  const first = p.legs[0].contract.strike!.value!;
  return (
    <div className={`mt-6 border-t border-border pt-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <StepHeading n={4} title="Your numbers" sub={`Settles ${shortDate(sized.market.expiry)}. The payout grows the further the price ${rising ? "rises" : "falls"}.`} />
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
