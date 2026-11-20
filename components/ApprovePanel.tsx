"use client";

import Link from "next/link";
import { useState } from "react";
import { usd } from "@/lib/format";

export interface ApproveLeg {
  marketId: string;
  symbol: string;
  outcome: "yes" | "no";
  quantity: number;
  limitPrice: number;
}

interface ExecResult {
  ok: boolean;
  hedgeId?: string;
  mode?: "paper" | "live";
  problems?: string[];
  error?: string;
}

/** Review -> explicit acknowledgement -> server re-validates and places. Shared by every flow. */
export function ApprovePanel({
  legs,
  totalCost,
  title,
  segment,
  profile,
  successTitle,
  onDone,
}: {
  legs: ApproveLeg[];
  totalCost: number;
  title: string;
  segment: "crypto" | "business";
  profile: unknown;
  successTitle: string;
  onDone?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);

  async function approve() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/hedge/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, segment, profile, legs }),
      });
      const body = await res.json();
      setResult(body.ok ? body : { ok: false, problems: body.problems, error: body.error });
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="mt-5 rounded-xl border border-good p-4">
        <p className="font-semibold">{successTitle} ✓</p>
        <p className="mt-1 text-sm text-text-2">
          {result.mode === "paper"
            ? "Recorded as a paper trade at live Gemini prices. No real money moved."
            : "Orders sent to Gemini. Fills will show in My hedges."}{" "}
          Hedgehog is sealing a receipt of it on Solana, so you can prove you hedged at these odds, at this time.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {result.hedgeId && (
            <Link href={`/receipt/${result.hedgeId}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
              See my receipt
            </Link>
          )}
          <Link href="/positions" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">See my hedges</Link>
          {onDone && <button onClick={onDone} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      {result && !result.ok && (
        <div className="mt-4 rounded-lg bg-warn-bg p-3 text-sm">
          <p className="font-medium">Nothing was placed.</p>
          <ul className="mt-1 list-disc pl-5">{(result.problems ?? [result.error]).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {!confirming ? (
        <button
          disabled={legs.length === 0}
          onClick={() => {
            setConfirming(true);
            setUnderstood(false);
          }}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-medium text-accent-ink disabled:opacity-50 sm:w-auto"
        >
          Review & approve
        </button>
      ) : (
        <div className="mt-5 rounded-xl border border-accent p-4">
          <p className="font-medium">
            Approve {legs.length} order{legs.length > 1 ? "s" : ""} for up to {usd(totalCost)}?
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-text-2">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
            I understand this reduces but does not remove my losses, and I can lose the {usd(totalCost)} I pay. I&apos;ve read the{" "}
            <Link href="/legal/risk" target="_blank" className="text-accent underline underline-offset-2">
              Risk Disclosure
            </Link>{" "}
            and agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="text-accent underline underline-offset-2">
              Terms
            </Link>
            .
          </label>
          <div className="mt-4 flex gap-3">
            <button disabled={!understood || sending} onClick={approve} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
              {sending ? "Placing…" : "Approve"}
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
