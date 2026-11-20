"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import type { ProofStep } from "@/lib/archive/merkle";
import { verifyReading, verifyReceipt, type ReceiptCheck, type VerifyResult } from "@/lib/archive/verify";
import type { ReceiptDocument } from "@/lib/hedges/receipt";
import { dateTime, qty, usd } from "@/lib/format";

// A hedge receipt anyone can check: what was hedged, at what price and against which odds,
// with a button that verifies it against Solana from the browser (Hedgehog isn't trusted).

interface KickoffInfo {
  ticker: string;
  title: string;
  startTime: number;
  readingTs: number;
  count: number;
  root: string;
  txUrl: string | null;
}

interface ReceiptResponse {
  hedgeId: string;
  document: string;
  sha256: string;
  cluster: string | null;
  signature: string | null;
  sealedAt: number | null;
  error: string | null;
  archiveOn: boolean;
  txUrl: string | null;
  kickoffs: KickoffInfo[];
}

type OddsCheck = { state: "checking" } | { state: "later"; note: string } | { state: "done"; result: VerifyResult; txUrl: string };

const HOUR = 3600_000;
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
/** The market's chance of the outcome the order pays on (YES, or NO = 1 − YES). */
const chance = (r: ReceiptDocument["oddsSeen"][number], outcome = "yes") => {
  const mid = r.yesBid !== null && r.yesAsk !== null ? (r.yesBid + r.yesAsk) / 2 : (r.last ?? r.yesAsk ?? r.yesBid);
  return mid === null ? "—" : `${Math.round((outcome === "no" ? 1 - mid : mid) * 100)}%`;
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

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [check, setCheck] = useState<ReceiptCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [odds, setOdds] = useState<Record<string, OddsCheck>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/receipts/${encodeURIComponent(id)}`);
    const body = await res.json();
    if (!res.ok) setMissing(body.error ?? "Receipt not found.");
    else setData(body);
    return res.ok ? (body as ReceiptResponse) : null;
  }, [id]);

  // Load, and while the receipt is being sealed, check back every few seconds.
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await load().catch(() => null);
      if (!stop && r && !r.signature && r.archiveOn && !r.error) t = setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [load]);

  const doc = data ? (JSON.parse(data.document) as ReceiptDocument) : null;
  const outcomeOf = (symbol: string) => doc?.orders.find((o) => o.symbol === symbol)?.outcome ?? "yes";

  async function verify() {
    if (!data?.signature || !data.cluster || !doc) return;
    setChecking(true);
    setCheckError(null);
    setCheck(null);
    try {
      setCheck(await verifyReceipt(data.document, data.hedgeId, data.signature, data.cluster));
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
    // Each odds reading the hedge used is also in its hour's sealed archive, once that hour is sealed.
    for (const r of doc.oddsSeen) {
      const key = `${r.symbol}@${r.ts}`;
      setOdds((o) => ({ ...o, [key]: { state: "checking" } }));
      try {
        const res = await fetch(`/api/archive/proof?symbol=${encodeURIComponent(r.symbol)}&ts=${r.ts}`);
        const p = (await res.json()) as { error?: string; proof: ProofStep[]; signature: string; cluster: string; txUrl: string; reading: typeof r };
        if (!res.ok) {
          const sealsAt = new Date(Math.floor(r.ts / HOUR) * HOUR + HOUR + 10 * 60_000);
          setOdds((o) => ({
            ...o,
            [key]: { state: "later", note: `Its hour is sealed after ${sealsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Check back then.` },
          }));
          continue;
        }
        const result = await verifyReading(r, p.proof, p.signature, p.cluster);
        setOdds((o) => ({ ...o, [key]: { state: "done", result, txUrl: p.txUrl } }));
      } catch (e) {
        setOdds((o) => ({ ...o, [key]: { state: "later", note: (e as Error).message } }));
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Hedge receipt</h1>
        <p className="mt-3 text-text-2">{missing}</p>
        <Link href="/positions" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          ← My hedges
        </Link>
      </main>
    );
  }
  if (!data || !doc) return <main className="mx-auto max-w-3xl px-4 py-12" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-surface-2" /></main>;

  const sealed = !!data.signature;
  const sealing = !sealed && data.archiveOn && !data.error;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-accent">Hedge receipt</p>
        <button onClick={copyLink} className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold hover:border-accent hover:text-accent">
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
      </div>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-2">
        <span>Approved {dateTime(doc.approvedAt)}</span>
        {doc.mode === "paper" && <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">Practice trade: no real money moved</span>}
        {sealed ? (
          <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-semibold text-good">✓ Sealed on Solana{data.cluster === "devnet" ? " devnet" : ""}</span>
        ) : sealing ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">Sealing on Solana…</span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-3" title={data.error ?? undefined}>
            {data.archiveOn ? "Not sealed yet: retrying" : "Not sealed (archive off)"}
          </span>
        )}
      </p>

      {/* The deal */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-3">Paid</p>
            <p className="text-2xl font-semibold tabular-nums">{usd(doc.totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-text-3">Pays back up to</p>
            <p className="text-2xl font-semibold tabular-nums text-good">{usd(doc.maxPayout)}</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-text-3">
              <tr>
                <th className="py-1 font-normal">Order</th>
                <th className="py-1 text-right font-normal">Contracts</th>
                <th className="py-1 text-right font-normal">Price</th>
                <th className="py-1 text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.orders.map((o) => (
                <tr key={o.symbol}>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{o.outcome.toUpperCase()}</span> <span className="break-all text-text-2">{o.symbol}</span>
                  </td>
                  <td className="py-2 text-right">{qty(o.quantity)}</td>
                  <td className="py-2 text-right">{usd(o.fillPrice ?? o.limitPrice)}</td>
                  <td className="py-2 text-right capitalize">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs font-semibold text-text-2">Market&apos;s chance of what each order pays on, when it was approved</p>
        <ul className="mt-1 space-y-1 text-sm">
          {doc.oddsSeen.map((r) => (
            <li key={`${r.symbol}@${r.ts}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-text-2">{r.symbol}</span>
              <span className="shrink-0 tabular-nums">
                <b className="font-semibold">
                  {chance(r, outcomeOf(r.symbol))} {outcomeOf(r.symbol).toUpperCase()}
                </b>{" "}
                <span className="text-text-3">· {dateTime(r.ts)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Kickoff: the odds right before play began, sealed separately */}
      {data.kickoffs.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm sm:p-6">
          {data.kickoffs.map((k) => (
            <p key={k.ticker}>
              <b className="font-semibold">Odds at kickoff sealed for {k.title}.</b>{" "}
              <span className="text-text-2">
                {k.count} readings from {dateTime(k.readingTs)}, before the {dateTime(k.startTime)} start. {doc.approvedAt < new Date(k.startTime).toISOString() ? "This hedge was approved before kickoff." : ""}
              </span>{" "}
              {k.txUrl && (
                <a href={k.txUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                  See the transaction ↗
                </a>
              )}
            </p>
          ))}
        </section>
      )}

      {/* Verify */}
      <section className="mt-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="verify-h">
        <h2 id="verify-h" className="text-xl font-bold tracking-tight">
          Check it yourself
        </h2>
        <p className="mt-1 text-sm text-text-2">
          Hedgehog put a fingerprint of this exact receipt on Solana when the hedge was approved. Your browser recomputes it and reads Solana directly, so you
          don&apos;t have to trust Hedgehog.
        </p>
        <button
          onClick={verify}
          disabled={!sealed || checking}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-ink disabled:opacity-50 sm:w-auto"
        >
          {checking ? "Checking…" : sealed ? "Verify on Solana" : "Verify on Solana (once sealed)"}
        </button>

        {checkError && <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{checkError}</p>}
        {check && (
          <ol className="mt-4 space-y-3">
            <Step state="ok">
              Your browser fingerprinted this receipt: <code className="break-all font-mono text-xs">{short(check.computedSha)}</code>
            </Step>
            <Step state={check.onChain ? "ok" : "bad"}>
              {check.onChain ? (
                <>
                  Solana recorded <code className="break-all font-mono text-xs">{short(check.onChain.sha256)}</code> for this hedge
                  {check.slotTime && <> on {dateTime(check.slotTime)}</>}.{" "}
                  {data.txUrl && (
                    <a href={data.txUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                      See the transaction ↗
                    </a>
                  )}
                </>
              ) : (
                "Couldn't read the fingerprint from Solana right now. Try again in a moment."
              )}
            </Step>
            <Step state={check.matches ? "ok" : check.onChain ? "bad" : "wait"}>
              <span className={`font-semibold ${check.matches ? "text-good" : "text-bad"}`}>
                {check.matches
                  ? "They match: this receipt is exactly what was recorded, and it hasn't been changed since."
                  : check.onChain
                    ? "They don't match: this receipt differs from what was recorded on Solana."
                    : "Not checked yet."}
              </span>
            </Step>
            {doc.oddsSeen.map((r) => {
              const c = odds[`${r.symbol}@${r.ts}`];
              if (!c) return null;
              return (
                <Step key={`${r.symbol}@${r.ts}`} state={c.state === "done" ? (c.result.matches ? "ok" : "bad") : "wait"}>
                  The odds reading for <span className="break-all">{r.symbol}</span>{" "}
                  {c.state === "checking" ? (
                    "is being checked against its hour's seal…"
                  ) : c.state === "later" ? (
                    <>isn&apos;t in a sealed hour yet. {c.note}</>
                  ) : c.result.matches ? (
                    <>
                      is in that hour&apos;s sealed odds archive, unchanged.{" "}
                      <a href={c.txUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                        See the hour&apos;s transaction ↗
                      </a>
                    </>
                  ) : (
                    "doesn't match its hour's seal."
                  )}
                </Step>
              );
            })}
          </ol>
        )}

        <details className="mt-5 rounded-xl border border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">The exact receipt that was fingerprinted</summary>
          <p className="mt-2 text-xs text-text-3">
            SHA-256 <code className="break-all font-mono">{data.sha256}</code>. The promo terms are included only as a fingerprint (termsSha256), so this
            receipt can be shared without spelling out your numbers.
          </p>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed">{data.document}</pre>
        </details>
      </section>

      <Link href="/positions" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
        ← My hedges
      </Link>
    </main>
  );
}
