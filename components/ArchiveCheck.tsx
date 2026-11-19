"use client";

import type { ArchiveReading, ProofStep } from "@/lib/archive/merkle";
import { verifyReading, type VerifyResult } from "@/lib/archive/verify";
import { dateTime } from "@/lib/format";

// Checking one archived reading against the fingerprint sealed on Solana: Hedgehog sends
// the reading and its proof, the browser rebuilds the fingerprint and reads Solana itself.
// Shared by the archive page and the past-promo look-back.

export interface Proof {
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

export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
export const hourLabel = (ms: number) =>
  `${new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}–${new Date(ms + 3600_000).toLocaleTimeString("en-US", { hour: "numeric" })}`;

/** Fetch the proof for one reading, then verify it against Solana from this browser. */
export async function checkReading(symbol: string, ts: number): Promise<{ proof: Proof; result: VerifyResult }> {
  const p = (await (await fetch(`/api/archive/proof?symbol=${encodeURIComponent(symbol)}&ts=${ts}`)).json()) as Proof & { error?: string };
  if (p.error) throw new Error(p.error);
  return { proof: p, result: await verifyReading(p.reading, p.proof, p.signature, p.cluster) };
}

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

export function ProofSteps({ proof, result }: { proof: Proof; result: VerifyResult }) {
  return (
    <ol className="mt-3 space-y-3">
      <Step state="ok">
        Hedgehog sent the reading and {proof.proof.length} linking hashes (one hour holds {proof.count.toLocaleString("en-US")} readings).
      </Step>
      <Step state="ok">
        Your browser rebuilt that hour&apos;s fingerprint from them: <code className="break-all font-mono text-xs">{shortHash(result.computedRoot)}</code>
      </Step>
      <Step state={result.onChain ? "ok" : "bad"}>
        {result.onChain ? (
          <>
            Solana recorded <code className="break-all font-mono text-xs">{shortHash(result.onChain.root)}</code> for {hourLabel(result.onChain.hourStart)}
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
  );
}
