"use client";

import { useEffect, useState } from "react";
import type { ArchiveReading, ProofStep } from "@/lib/archive/merkle";
import { verifyReading, type VerifyResult } from "@/lib/archive/verify";
import { dateTime } from "@/lib/format";

interface Batch {
  hourStart: number;
  count: number;
  root: string;
  cluster: string;
  signature: string | null;
  anchoredAt: number | null;
  error: string | null;
  txUrl: string | null;
}
type Sample = ArchiveReading & { label: string; marketTitle: string; category: string };
interface Archive {
  cluster: string;
  wallet: string;
  walletUrl: string;
  totals: { readings: number; contracts: number; markets: number; since: number | null; hoursSealed: number };
  batches: Batch[];
  samples: Sample[];
  error?: string;
}
interface Proof {
  reading: ArchiveReading;
  proof: ProofStep[];
  serverRoot: string;
  sealedRoot: string;
  hourStart: number;
  count: number;
  signature: string;
  cluster: string;
  txUrl: string;
}

const n = (x: number) => x.toLocaleString("en-US");
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const hourLabel = (ms: number) =>
  `${new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}–${new Date(ms + 3600_000).toLocaleTimeString("en-US", { hour: "numeric" })}`;
const odds = (r: ArchiveReading) => {
  const mid = r.yesBid !== null && r.yesAsk !== null ? (r.yesBid + r.yesAsk) / 2 : (r.last ?? r.yesAsk ?? r.yesBid);
  return mid === null ? "—" : `${Math.round(mid * 100)}%`;
};

function Step({ state, children }: { state: "wait" | "ok" | "bad"; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          state === "ok" ? "bg-good-soft text-good" : state === "bad" ? "bg-bad-soft text-bad" : "bg-surface-2 text-text-3"
        }`}
        aria-hidden
      >
        {state === "ok" ? "✓" : state === "bad" ? "✕" : "·"}
      </span>
      <div className="min-w-0 text-sm">{children}</div>
    </li>
  );
}

/** Pick a reading, fetch its proof from Hedgehog, then check it against Solana from the browser. */
function VerifyBox({ samples }: { samples: Sample[] }) {
  const [picked, setPicked] = useState<Sample | null>(samples[0] ?? null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(s: Sample) {
    setPicked(s);
    setBusy(true);
    setError(null);
    setProof(null);
    setResult(null);
    try {
      const p = (await (await fetch(`/api/archive/proof?symbol=${encodeURIComponent(s.symbol)}&ts=${s.ts}`)).json()) as Proof & { error?: string };
      if (p.error) throw new Error(p.error);
      setProof(p);
      setResult(await verifyReading(p.reading, p.proof, p.signature, p.cluster));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!samples.length) return <p className="text-sm text-text-2">Readings can be checked here once the first hour is sealed on Solana.</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <p className="text-sm font-medium">1. Pick a reading</p>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {samples.map((s) => (
            <li key={s.symbol}>
              <button
                onClick={() => run(s)}
                disabled={busy}
                aria-pressed={picked?.symbol === s.symbol}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2 disabled:opacity-60 ${
                  picked?.symbol === s.symbol ? "bg-accent-soft" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.marketTitle}</span>
                  <span className="block truncate text-xs text-text-3">
                    {s.label} · {s.category} · {dateTime(s.ts)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{odds(s)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium">2. Check it against Solana</p>
        {!proof && !busy && !error && <p className="mt-2 text-sm text-text-2">Pick any reading. Your browser does the checking, not Hedgehog.</p>}
        {busy && <p className="mt-2 text-sm text-text-2">Checking…</p>}
        {error && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {proof && result && (
          <ol className="mt-3 space-y-3">
            <Step state="ok">
              Hedgehog sent the reading and {proof.proof.length} linking hashes (one hour holds {n(proof.count)} readings).
            </Step>
            <Step state="ok">
              Your browser rebuilt that hour&apos;s fingerprint from them: <code className="break-all font-mono text-xs">{short(result.computedRoot)}</code>
            </Step>
            <Step state={result.onChain ? "ok" : "bad"}>
              {result.onChain ? (
                <>
                  Solana recorded <code className="break-all font-mono text-xs">{short(result.onChain.root)}</code> for {hourLabel(result.onChain.hourStart)}
                  {result.slotTime && <> on {dateTime(result.slotTime)}</>}.{" "}
                  <a href={proof.txUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                    See the transaction ↗
                  </a>
                </>
              ) : (
                "Couldn't read the fingerprint from Solana right now. Try again in a moment."
              )}
            </Step>
            <Step state={result.matches ? "ok" : result.onChain ? "bad" : "wait"}>
              <span className={`font-semibold ${result.matches ? "text-good" : "text-bad"}`}>
                {result.matches
                  ? "They match: this reading is exactly what was recorded, and it hasn't been changed since."
                  : result.onChain
                    ? "They don't match: this reading differs from what was recorded on Solana."
                    : "Not checked yet."}
              </span>
            </Step>
          </ol>
        )}
      </div>
    </div>
  );
}

export default function ArchivePage() {
  const [data, setData] = useState<Archive | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const t = data?.totals;
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Odds archive</h1>
      <p className="mt-2 max-w-3xl text-text-2">
        Gemini&apos;s API shows today&apos;s odds but keeps no history, so Hedgehog records every market every 5 minutes. Each hour is sealed with a
        fingerprint on Solana, so anyone can check the history hasn&apos;t been changed since.
      </p>

      {!data && !failed && <div className="mt-8 h-40 animate-pulse rounded-2xl border border-border bg-surface" aria-busy="true" />}
      {(failed || data?.error) && (
        <p className="mt-8 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">Couldn&apos;t load the archive{data?.error ? `: ${data.error}` : ""}.</p>
      )}

      {data && t && !data.error && (
        <>
          <section className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-4" aria-label="Archive totals">
            {[
              ["Readings recorded", n(t.readings), t.since ? `since ${dateTime(t.since)}` : ""],
              ["Contracts", n(t.contracts), `in ${n(t.markets)} markets`],
              ["Hours sealed on Solana", n(t.hoursSealed), data.cluster === "devnet" ? "Solana devnet" : "Solana mainnet"],
              ["Cost per seal", "< $0.001", "one small transaction an hour"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-3 py-3 sm:px-4">
                <p className="text-xs text-text-2">{label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
                <p className="text-xs text-text-3">{note}</p>
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="verify-h">
            <h2 id="verify-h" className="text-xl font-bold tracking-tight">
              Check it yourself
            </h2>
            <p className="mb-5 mt-1 text-sm text-text-2">
              Only fingerprints go on-chain; the odds stay with Hedgehog. A fingerprint changes if even one reading in its hour changes.
            </p>
            <VerifyBox samples={data.samples} />
          </section>

          <section className="mt-8" aria-labelledby="hours-h">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="hours-h" className="text-xl font-bold tracking-tight">
                Sealed hours
              </h2>
              <a href={data.walletUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent hover:underline">
                Archive wallet on Solana ↗
              </a>
            </div>
            {data.batches.length === 0 ? (
              <p className="mt-3 text-sm text-text-2">No hours sealed yet. The first one is sealed shortly after it ends.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="w-full text-sm tabular-nums">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-text-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Hour</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Readings</th>
                      <th className="px-4 py-2.5 font-semibold">Fingerprint</th>
                      <th className="px-4 py-2.5 font-semibold">On Solana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.batches.map((b) => (
                      <tr key={b.hourStart}>
                        <td className="whitespace-nowrap px-4 py-2.5">{hourLabel(b.hourStart)}</td>
                        <td className="px-4 py-2.5 text-right">{n(b.count)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{short(b.root)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {b.txUrl ? (
                            <a href={b.txUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                              ✓ Sealed ↗
                            </a>
                          ) : (
                            <span className="text-warn" title={b.error ?? undefined}>
                              Waiting to be recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="mt-6 text-xs text-text-3">
            Data provided by{" "}
            <a href="https://www.gemini.com" target="_blank" rel="noreferrer" className="underline hover:text-text">
              Gemini
            </a>
            . Odds are Gemini&apos;s market data; Hedgehog keeps them for its own charts, and only fingerprints are made public. Hours with no
            fingerprint are times the recorder was off (for example during exchange maintenance). A public API for the archive is coming next.
          </p>
        </>
      )}
    </main>
  );
}
