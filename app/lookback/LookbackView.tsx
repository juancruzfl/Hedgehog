"use client";

import { useEffect, useState } from "react";
import { checkReading, ProofSteps, type Proof } from "@/components/ArchiveCheck";
import { LookbackChart } from "@/components/charts";
import type { VerifyResult } from "@/lib/archive/verify";
import { pct, usd } from "@/lib/format";
import type { LookbackResult } from "@/lib/lookback/data";
import { etTime, triggerPhrase } from "@/lib/lookback/lookback";
import { cap, headline, whenLabel } from "./copy";

const signed = (n: number | null) => (n === null ? "—" : n === 0 ? usd(0) : `${n > 0 ? "+" : "−"}${usd(Math.abs(n))}`);

function Box({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-3 sm:px-4 ${strong ? "bg-accent-soft" : "bg-surface-2"}`}>
      <p className="text-xs text-text-2">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {note && <p className="text-xs leading-snug text-text-3">{note}</p>}
    </div>
  );
}

/** Check the exact price used against the fingerprint sealed on Solana, from this browser. */
function CheckPrice({ symbol, ts, sealed }: { symbol: string; ts: number; sealed: boolean }) {
  const [state, setState] = useState<{ proof: Proof; result: VerifyResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sealed) {
    return <p className="text-sm text-text-2">The hour this price was recorded in isn&apos;t sealed on Solana yet. Each hour is sealed shortly after it ends.</p>;
  }
  return (
    <div>
      {!state && (
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setState(await checkReading(symbol, ts));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-text-3 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Check this price against Solana"}
        </button>
      )}
      {error && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {state && <ProofSteps proof={state.proof} result={state.result} />}
    </div>
  );
}

function ShareButtons() {
  const [copied, setCopied] = useState(false);
  // Set after load so the server and browser render the same HTML.
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(window.location.search), []);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link", window.location.href);
          }
        }}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
      >
        {copied ? "Link copied" : "Copy share link"}
      </button>
      <a
        href={`/api/lookback/card${search}`}
        download="hedgehog-lookback.png"
        className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-text-3"
      >
        Download image
      </a>
    </div>
  );
}

export function LookbackView({ r }: { r: LookbackResult }) {
  const h = headline(r);
  const m = r.math;
  const isGame = r.event.category === "Sports";
  const settledText = r.resolution === null ? "Not settled yet" : r.resolution === "yes" ? cap(r.trigger) : cap(triggerPhrase(r.event.category, r.label, "not"));

  return (
    <div className="space-y-6">
      {/* The shareable summary */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="lb-title">
        <p id="lb-title" className="text-sm font-medium text-text-2">
          {h.title}
        </p>
        <p className={`mt-1 text-3xl font-bold tracking-tight sm:text-4xl ${h.tone === "good" ? "text-good" : ""}`}>{h.big}</p>
        <p className="mt-2 max-w-2xl text-text-2">{h.line}</p>

        <div className="mt-5 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <Box label="Without a hedge" value={signed(m.without)} note={r.resolution === null ? "once it settles" : "what the promo cost you"} />
          <Box label="With the hedge" value={signed(m.withHedge)} note={`worst case was ${signed(m.worstWithHedge)}, known up front`} strong />
          <Box label="Hedge cost" value={usd(m.hedgeCost)} note={`${m.contracts.toLocaleString("en-US")} contracts at ${usd(m.price, 2)}`} />
        </div>

        <div className="mt-5">
          <ShareButtons />
        </div>
      </section>

      {/* How the numbers came about */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="lb-how">
        <h2 id="lb-how" className="text-xl font-bold tracking-tight">
          How it would have worked
        </h2>
        <ol className="mt-3 space-y-2 text-sm">
          <li>
            <span className="font-semibold">1. Buy the hedge ({whenLabel(r.when)}).</span> On {etTime(r.boughtAt)}, Gemini&apos;s market gave &ldquo;{triggerPhrase(r.event.category, r.label, "future")}&rdquo; a{" "}
            {r.chance === null ? "" : `${pct(r.chance)} `}chance. {m.contracts.toLocaleString("en-US")} YES contracts at {usd(m.price, 2)} each ={" "}
            <span className="font-semibold">{usd(m.hedgeCost)}</span>.
          </li>
          <li>
            <span className="font-semibold">2. {isGame ? "The game is played." : "The day plays out."}</span> Each contract pays $1 if {triggerPhrase(r.event.category, r.label, "future")}, so the
            hedge pays back {usd(m.contracts)}: {m.contracts >= r.promoCost ? "the whole promo cost" : `nearly the whole ${usd(r.promoCost)} promo cost`}.
          </li>
          <li>
            <span className="font-semibold">3. Gemini settles it.</span> {settledText}.{" "}
            {r.resolution === null ? "Check back after the result is final." : `The hedge paid ${usd(m.payout!)}.`}
          </li>
        </ol>
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Chance that {triggerPhrase(r.event.category, r.label, "future")}, as the market saw it</p>
          <LookbackChart data={r.series} boughtAt={r.boughtAt} cutoff={r.event.cutoff} cutoffLabel={isGame ? "Kickoff" : "10 AM"} />
          <p className="mt-1 text-xs text-text-3">
            The dot is the price used. Only prices from before {isGame ? "kickoff" : "10 AM ET that day"} are used, so the look-back never uses hindsight. Costs exclude Gemini
            trading fees. Data provided by Gemini, recorded by Hedgehog.
          </p>
        </div>
      </section>

      {/* The blockchain part: anyone can check the price wasn't made up */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="lb-check">
        <h2 id="lb-check" className="text-xl font-bold tracking-tight">
          Check it yourself
        </h2>
        <p className="mb-4 mt-1 text-sm text-text-2">
          The {usd(m.price, 2)} price comes from Hedgehog&apos;s odds archive. Every hour of readings is sealed with a fingerprint on Solana, so this number can be checked, not just
          trusted. Your browser does the checking.
        </p>
        <CheckPrice symbol={r.symbol} ts={r.boughtAt} sealed={r.sealed} />
        <p className="mt-4 text-xs text-text-3">
          <a href="/archive" className="underline hover:text-text">
            More about the odds archive
          </a>
        </p>
      </section>
    </div>
  );
}
