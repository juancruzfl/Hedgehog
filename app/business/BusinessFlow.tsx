"use client";

import { Sheet } from "@/components/Sheet";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PinnedStage } from "@/components/PinnedStage";
import { Segmented } from "@/components/ui";
import type { Analysis, StepEvent } from "@/lib/business/analyze";
import { BUSINESS_EXAMPLES } from "@/lib/business/examples";
import { shortDate, usd } from "@/lib/format";
import type { ExposureRange, RiskProfile } from "@/lib/types";
import { AgentSteps, FocusSteps, HowItWorksTip, initialSteps, type StepState } from "./AgentSteps";
import { EventAvenueCard, PriceAvenueCard } from "./AvenueCard";
import { EventResult, PriceResult, unitLabel, type SizeResponse } from "./results";
import { NoMatch } from "./NoMatch";
import { suggestRewrites } from "@/lib/business/rewrites";

type Phase = "input" | "running" | "finishing" | "results";
const FADE_MS = 700; // the steps fade out before the options fade in
const STEP_MIN_MS = 650; // each step stays in focus at least this long, even when the engine is instant
const PRICE_DEFAULTS = { startMove: 0.03, capMove: 0.25 };

async function sizeOption(body: Record<string, unknown>): Promise<SizeResponse | null> {
  try {
    const res = await fetch("/api/business/size", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as SizeResponse;
  } catch {
    return null;
  }
}

export function BusinessFlow({ examples = BUSINESS_EXAMPLES }: { examples?: { label: string; text: string }[] }) {
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("q") ?? "");
  const [phase, setPhase] = useState<Phase>("input");
  const [steps, setSteps] = useState<StepState[]>(initialSteps);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [usedFallback, setUsedFallback] = useState<false | true | "off">(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  // Per-option pricing for the cards: undefined = loading, null = can't be priced.
  const [priced, setPriced] = useState<(SizeResponse | null | undefined)[]>([]);

  // The option the user chose, and its fine-tuning controls.
  const [chosen, setChosen] = useState<number | null>(null);
  const [sizeTo, setSizeTo] = useState<keyof ExposureRange>("expected");
  const [hedgeRatio, setHedgeRatio] = useState(1);
  const [startMove, setStartMove] = useState(PRICE_DEFAULTS.startMove);
  const [capMove, setCapMove] = useState(PRICE_DEFAULTS.capMove);
  const [sized, setSized] = useState<SizeResponse | null>(null);
  const [sizing, setSizing] = useState(false);

  const setStep = (e: StepEvent) => setSteps((prev) => prev.map((s) => (s.id === e.step ? { ...s, status: e.status, detail: e.detail ?? s.detail } : s)));

  async function analyze(override?: string) {
    const input = override ?? text;
    if (override !== undefined) setText(override);
    setPhase("running");
    setSteps(initialSteps());
    setError(null);
    setAnalysis(null);
    setPriced([]);
    setChosen(null);
    setSized(null);
    setUsedFallback(false);

    let result: { profile: RiskProfile; followUps: string[]; analysis: Analysis; fallback?: boolean | "off" } | null = null;
    try {
      const res = await fetch("/api/business/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.body) throw new Error("No response from the server.");
      const reader = res.body.getReader();
      let shown: Promise<unknown> = Promise.resolve();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "step") {
            // Queue step changes so each one gets its moment in focus.
            shown = shown.then(() => {
              setStep(ev);
              return new Promise((r) => setTimeout(r, STEP_MIN_MS));
            });
          } else if (ev.type === "result") result = ev;
          else if (ev.type === "error") throw new Error(ev.error);
        }
      }
      await shown;
      if (!result) throw new Error("The analysis ended without a result.");
    } catch (e) {
      setError((e as Error).message);
      setPhase("input");
      return;
    }

    setProfile(result.profile);
    setFollowUps(result.followUps);
    setUsedFallback(result.fallback === "off" ? "off" : Boolean(result.fallback));
    setAnalysis(result.analysis);
    await priceOptions(result.profile, result.analysis, true);
    // Let the finished steps sit for a beat, then fade them into the options.
    setPhase("finishing");
    await new Promise((r) => setTimeout(r, FADE_MS + 500));
    setPhase("results");
    window.scrollTo({ top: 0 });
  }

  /** Price every option at default sizing, so each card shows its numbers. */
  async function priceOptions(p: RiskProfile, a: Analysis, report: boolean) {
    if (a.type === "none") {
      if (report) setStep({ step: "price", status: "error", detail: "Nothing to price" });
      return;
    }
    if (a.type === "price") {
      if (report) setStep({ step: "price", status: "active", detail: "Pricing a hedge on the stand-in market" });
      const r = await sizeOption({ profile: p, marketId: a.marketId, ...PRICE_DEFAULTS });
      setPriced([r]);
      if (report) {
        const prop = r?.kind === "price" ? r.proposal : null;
        setStep({
          step: "price",
          status: "done",
          detail: prop?.legs.length ? `Pay ${usd(prop.totalCost)} now to get back up to ${usd(prop.maxPayout)}` : "No prices in the default range",
        });
      }
      return;
    }
    if (report) setStep({ step: "price", status: "active", detail: `Pricing ${a.matches.length} option${a.matches.length > 1 ? "s" : ""}` });
    setPriced(a.matches.map(() => undefined));
    const out = await Promise.all(
      a.matches.map((m) =>
        sizeOption({ profile: p, marketId: m.contract.marketId, symbol: m.contract.symbol, outcome: m.outcome, sizeTo: "expected", hedgeRatio: 1 }),
      ),
    );
    const usable = out.map((r) => (r?.kind === "event" && r.proposal.legs.length ? r : null));
    setPriced(usable);
    if (report) {
      const best = usable
        .map((r, i) => ({ r, q: a.matches[i].quality }))
        .filter((x) => x.r)
        .sort((x, y) => (x.q === "exact" ? 0 : 1) - (y.q === "exact" ? 0 : 1) || x.r!.proposal.totalCost - y.r!.proposal.totalCost)[0];
      setStep({
        step: "price",
        status: best ? "done" : "error",
        detail: best
          ? `Best: pay ${usd(best.r!.proposal.totalCost)} now to get ${usd(best.r!.proposal.maxPayout)} if it happens`
          : "No one is selling these outcomes right now",
      });
    }
  }

  // Arriving from the landing page with ?auto=1 runs the analysis straight away (once).
  const autoRan = useRef(false);
  const riskBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoRan.current || params.get("auto") !== "1" || text.trim().length < 10) return;
    autoRan.current = true;
    void analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editing the cost (or units) re-prices the option cards.
  const profileKey = profile ? JSON.stringify([profile.exposureUsd, profile.position?.quantity]) : "";
  useEffect(() => {
    if (phase !== "results" || !profile || !analysis) return;
    const t = setTimeout(() => void priceOptions(profile, analysis, false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey]);

  // Fine-tuning the chosen option (deterministic, no AI).
  useEffect(() => {
    if (chosen === null || !profile || !analysis || analysis.type === "none") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSizing(true);
      const m = analysis.type === "event" ? analysis.matches[chosen] : null;
      const body =
        analysis.type === "event"
          ? { profile, marketId: m!.contract.marketId, symbol: m!.contract.symbol, outcome: m!.outcome, sizeTo, hedgeRatio }
          : { profile, marketId: analysis.marketId, startMove, capMove };
      const r = await sizeOption(body);
      if (!ctrl.signal.aborted) {
        setSized(r);
        setSizing(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [chosen, profile, analysis, sizeTo, hedgeRatio, startMove, capMove]);

  function choose(i: number) {
    setChosen(i);
    setSizeTo("expected");
    setHedgeRatio(1);
  }

  /** Back to the chat box. With `next`, it replaces the text and selects the first [blank]. */
  function editRisk(next?: string) {
    if (next !== undefined) setText(next);
    setPhase("input");
    setAnalysis(null);
    setChosen(null);
    setSized(null);
    window.scrollTo({ top: 0 });
    setTimeout(() => {
      const t = riskBox.current;
      if (!t) return;
      t.focus();
      const a = t.value.indexOf("[");
      const b = a >= 0 ? t.value.indexOf("]", a) : -1;
      // Select the first blank so typing fills it in; otherwise put the cursor at the end.
      if (a >= 0 && b > a) t.setSelectionRange(a, b + 1);
      else t.setSelectionRange(t.value.length, t.value.length);
    }, 0);
  }

  function setExpected(v: number) {
    if (!profile || !(v >= 0)) return;
    const r = profile.exposureUsd;
    const scale = r.expected > 0 ? v / r.expected : 1;
    setProfile({ ...profile, exposureUsd: { low: r.low * scale, expected: v, high: r.high * scale } });
  }

  // ---------------- running: the engine's steps take the whole page ----------------
  if (phase === "running" || phase === "finishing") {
    return (
      <div
        className={`transition-opacity ease-out motion-reduce:transition-none ${phase === "finishing" ? "opacity-0" : "opacity-100"}`}
        style={{ transitionDuration: `${FADE_MS}ms`, transitionDelay: phase === "finishing" ? "500ms" : "0ms" }}
      >
        <div className="hh-fade-in flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-10">
          <p className="text-sm font-semibold text-accent">Working on your risk</p>
          <blockquote className="mt-2 max-w-2xl text-center text-text-2">
            &ldquo;{text.trim().length > 180 ? text.trim().slice(0, 180) + "…" : text.trim()}&rdquo;
          </blockquote>
          <div className="mt-10 w-full max-w-2xl">
            <FocusSteps steps={steps} />
          </div>
        </div>
      </div>
    );
  }

  // ---------------- input: the chat box is the page ----------------
  if (phase !== "results" || !profile || !analysis) {
    return (
      <div>
        <section className="flex min-h-[calc(90dvh-4rem)] flex-col justify-center py-10">
          <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
            What could hurt your business?{" "}
            <span className="relative -top-[0.12em] ml-1 inline-block align-middle">
              <HowItWorksTip />
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-text-2">
            Describe it in your own words. Hedgehog finds a Gemini market that pays out if it happens, so a surprise cost becomes a known one.
          </p>

          <div className="mx-auto mt-8 w-full max-w-3xl rounded-3xl border border-border bg-surface p-3 shadow-sm focus-within:border-accent sm:p-4">
            <label htmlFor="risk" className="sr-only">
              What&apos;s the risk?
            </label>
            <textarea
              ref={riskBox}
              id="risk"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && text.trim().length >= 10) {
                  e.preventDefault();
                  void analyze();
                }
              }}
              rows={6}
              placeholder="e.g. If the home team wins Sunday, wings are half price. That's about 500 orders at $6 off."
              className="w-full resize-none bg-transparent px-2 py-2 text-lg leading-relaxed outline-none placeholder:text-text-3"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-2 pt-3">
              <span className="text-xs text-text-3">Rough numbers are fine. Leave out anything confidential. Enter to send, Shift+Enter for a new line.</span>
              <button
                onClick={() => analyze()}
                disabled={text.trim().length < 10}
                className="ml-auto rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
              >
                Find a market →
              </button>
            </div>
          </div>

          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-text-3">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => {
                  setText(ex.text);
                  riskBox.current?.focus();
                }}
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-2 hover:border-accent hover:text-accent"
              >
                {ex.label}
              </button>
            ))}
          </div>
          {error && <p className="mx-auto mt-4 w-full max-w-3xl rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
        </section>
      </div>
    );
  }

  // ---------------- results ----------------
  const header = (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-accent">Your risk</p>
        {/* A clear way back to the chat box, with what they typed still in it */}
        <button
          onClick={() => editRisk()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text shadow-sm hover:border-accent hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
            <path d="m13.5 8.5 3 3" />
          </svg>
          Edit my risk
        </button>
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl [@media(max-height:800px)]:text-3xl">
        {profile.headline ?? profile.condition}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-2">
        <span>
          {shortDate(profile.window.start)}
          {shortDate(profile.window.end) !== shortDate(profile.window.start) && ` – ${shortDate(profile.window.end)}`}
        </span>
        {profile.position ? (
          <label className="flex items-center gap-1.5">
            You buy about
            <input
              type="number"
              min={0}
              value={Math.round(profile.position.quantity)}
              onChange={(e) => {
                const q = Number(e.target.value);
                if (q >= 0) setProfile({ ...profile, position: { ...profile.position!, quantity: q } });
              }}
              className="w-20 rounded-lg border border-border bg-surface px-2 py-0.5 font-semibold text-text tabular-nums outline-none focus:border-accent"
            />
            {unitLabel(profile.position.asset)}
          </label>
        ) : (
          <label className="flex items-center gap-1.5">
            Costs you about $
            <input
              type="number"
              min={0}
              value={Math.round(profile.exposureUsd.expected)}
              onChange={(e) => setExpected(Number(e.target.value))}
              className="w-24 rounded-lg border border-border bg-surface px-2 py-0.5 font-semibold text-text tabular-nums outline-none focus:border-accent"
            />
          </label>
        )}
      </div>
      {usedFallback && (
        <p className="mt-2 text-xs text-warn">
          {usedFallback === "off"
            ? "Test mode: AI is turned off (AI_MODE=off), so Hedgehog used its basic matcher."
            : "Our AI assistant was unavailable, so Hedgehog used its basic matcher. Double-check the details."}
        </p>
      )}
    </div>
  );

  return (
    <div className="hh-fade-in">
      {analysis.type === "none" ? (
        <NoMatch
          headline={profile.headline ?? profile.condition}
          reason={analysis.reason}
          examples={examples}
          onEdit={() => editRisk()}
          rewrites={suggestRewrites(text, profile)}
          onRewrite={(t) => editRisk(t)}
          onExample={(t) => void analyze(t)}
          steps={steps}
          followUps={followUps}
        />
      ) : analysis.type === "event" ? (
        <PinnedStage
          header={header}
          items={analysis.matches.map((m, i) => ({
            key: m.symbol + m.outcome,
            label: `option ${i + 1}`,
            chip: (
              <>
                Option {i + 1}
                <span className={`text-xs font-medium ${m.quality === "exact" ? "text-good" : "text-warn"}`}>
                  {m.quality === "exact" ? "Exact" : "Partial"}
                </span>
              </>
            ),
          }))}
          renderCard={(i) => (
            <EventAvenueCard
              m={analysis.matches[i]}
              i={i}
              n={analysis.matches.length}
              sized={priced[i] as Extract<SizeResponse, { kind: "event" }> | null | undefined}
              profile={profile}
              onUse={() => choose(i)}
            />
          )}
        />
      ) : (
        <PinnedStage
          header={header}
          items={[{ key: analysis.marketId, label: "option 1", chip: "Option 1" }]}
          renderCard={() => (
            <PriceAvenueCard
              title={analysis.marketTitle}
              notes={analysis.notes}
              spot={analysis.spot}
              sized={priced[0] as Extract<SizeResponse, { kind: "price" }> | null | undefined}
              onUse={() => choose(0)}
            />
          )}
        />
      )}

      {/* How it got here, plus anything that would sharpen the answer */}
      {analysis.type !== "none" && (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          <details className="rounded-2xl border border-border bg-surface px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold">How Hedgehog found this</summary>
            <div className="mt-4">
              <AgentSteps steps={steps} />
            </div>
          </details>
          {(followUps.length > 0 || profile.notes) && (
            <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
              {profile.notes && <p className="text-text-2">What we assumed: {profile.notes}</p>}
              {followUps.length > 0 && (
                <>
                  <p className="mt-2 font-semibold">To make this more accurate, add to your description:</p>
                  <ul className="mt-1 list-disc pl-5 text-text-2">
                    {followUps.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fine-tune and approve the chosen option */}
      {/* Fine-tuning opens as a popup over the options. */}
      {chosen !== null && analysis.type !== "none" && (
        <Sheet
          onClose={() => setChosen(null)}
          title="Fine-tune and approve"
          sub={
            analysis.type === "event"
              ? `Option ${chosen + 1}: ${analysis.matches[chosen].contract.marketTitle}: ${analysis.matches[chosen].contract.label}`
              : analysis.marketTitle.replace("?", "")
          }
        >
          {analysis.type === "event" ? (
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
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={hedgeRatio}
                  onChange={(e) => setHedgeRatio(Number(e.target.value))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
              </label>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-semibold">
                  Start paying after a {Math.round(startMove * 100)}% {profile.kind === "price_rise" ? "rise" : "drop"}
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.15}
                  step={0.01}
                  value={startMove}
                  onChange={(e) => setStartMove(Math.min(Number(e.target.value), capMove - 0.05))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold">Keep paying up to a {Math.round(capMove * 100)}% move</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.01}
                  value={capMove}
                  onChange={(e) => setCapMove(Math.max(Number(e.target.value), startMove + 0.05))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
              </label>
            </div>
          )}

          {sized?.kind === "event" && <EventResult sized={sized} profile={profile} loading={sizing} />}
          {sized?.kind === "price" && <PriceResult sized={sized} loading={sizing} />}
          {!sized && <p className="mt-6 text-sm text-text-3">{sizing ? "Pricing…" : "Couldn't price this option right now."}</p>}
        </Sheet>
      )}
    </div>
  );
}
