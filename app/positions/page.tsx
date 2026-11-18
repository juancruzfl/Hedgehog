"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Stat } from "@/components/ui";
import type { HedgeOutcome } from "@/lib/hedges/paper";
import type { HedgeRecord } from "@/lib/hedges/store";
import { qty, shortDate, timeUntil, usd } from "@/lib/format";

interface Data {
  mode: string;
  hedges: HedgeRecord[];
  outcomes: Record<string, HedgeOutcome>;
  connected?: boolean;
  error?: string;
}

type Status = "active" | "paid" | "partial" | "unused";

function statusOf(o: HedgeOutcome | undefined): Status {
  if (!o?.settled) return "active";
  if (o.net !== null && o.payout > 0) return o.net >= 0 ? "paid" : "partial";
  return "unused";
}

const created = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function StatusPill({ status, settlesAt }: { status: Status; settlesAt: string | null }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";
  if (status === "active")
    return (
      <span className={`${base} bg-accent-soft text-accent`}>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        Active{settlesAt ? ` · settles ${shortDate(settlesAt)}` : ""}
      </span>
    );
  if (status === "paid") return <span className={`${base} bg-good-soft text-good`}>✓ Paid out</span>;
  if (status === "partial") return <span className={`${base} bg-good-soft text-good`}>✓ Paid out part</span>;
  return <span className={`${base} bg-surface-2 text-text-2`}>Not needed</span>;
}

/** One hedge, in the user's terms: what it was for, what it cost, what it pays, where it stands. */
function HedgeCard({ h, o }: { h: HedgeRecord; o?: HedgeOutcome }) {
  const status = statusOf(o);
  const legs = o?.legs ?? [];
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-3">
            {h.segment === "business" ? "Business" : "Crypto"} · approved {created(h.createdAt)}
          </p>
          <h3 className="mt-1 text-lg font-bold leading-snug">{h.title}</h3>
        </div>
        <StatusPill status={status} settlesAt={o?.settlesAt ?? null} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="You paid" value={usd(h.totalCost)} />
        {status === "active" ? (
          <>
            <Stat label="Pays back up to" value={usd(h.maxPayout)} note="if it happens" />
            <Stat
              label="Worth today"
              value={o?.worthNow == null ? "—" : usd(o.worthNow)}
              note={o?.worthNow == null ? "no buyer right now" : "if you sold now"}
            />
          </>
        ) : (
          <>
            <Stat label="Paid back" value={usd(o?.payout ?? 0)} note={o?.payout ? "paid by Gemini" : undefined} />
            <Stat
              label="Overall"
              value={`${(o?.net ?? 0) >= 0 ? "+" : "−"}${usd(Math.abs(o?.net ?? 0))}`}
              note={status === "unused" ? "the cost of the cushion" : undefined}
            />
          </>
        )}
      </div>

      <p className="mt-3 text-sm text-text-2">
        {status === "active"
          ? `Settles ${o?.settlesAt ? `${shortDate(o.settlesAt)} (${timeUntil(o.settlesAt)})` : "when the market resolves"}. Gemini pays out automatically if it happens; nothing for you to do.`
          : status === "unused"
            ? "What you were worried about didn't happen, so the hedge expired. That's the good outcome: you only paid for peace of mind."
            : "It happened, and the hedge paid out to soften the hit."}
      </p>

      {legs.length > 0 && (
        <details className="group mt-4 rounded-xl border border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            See the order{legs.length === 1 ? "" : "s"} on Gemini ({legs.length})
          </summary>
          <ul className="mt-2 divide-y divide-border tabular-nums">
            {legs.map((l, k) => (
              <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="min-w-0">
                  {l.market}: <b className="font-semibold">{l.label}</b>
                  <span className="text-text-3"> · pays $1 each if {l.outcome === "yes" ? "it happens" : "it doesn't"}</span>
                </span>
                <span className="text-text-2">
                  {qty(l.quantity)} at {usd(l.price)}
                  {l.payout !== null && <span className={l.payout > 0 ? "text-good" : "text-text-3"}> · paid {usd(l.payout)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export default function PositionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const hedges = data?.hedges ?? [];
  const o = (h: HedgeRecord) => data?.outcomes[h.id];
  const active = hedges.filter((h) => statusOf(o(h)) === "active");
  const finished = hedges.filter((h) => statusOf(o(h)) !== "active");
  const putIn = hedges.reduce((s, h) => s + h.totalCost, 0);
  const paidBack = hedges.reduce((s, h) => s + (o(h)?.payout ?? 0), 0);
  const cushion = active.reduce((s, h) => s + h.maxPayout, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My hedges</h1>
          <p className="mt-1.5 text-text-2">Everything you&apos;ve approved, and how each one is doing.</p>
        </div>
        {data?.mode === "paper" && (
          <span className="rounded-full bg-warn-bg px-3 py-1 text-xs font-medium text-warn">Paper trading · live Gemini prices, no real money</span>
        )}
      </div>

      {!data && !failed && (
        <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading your hedges">
          <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-56 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
      )}
      {(failed || data?.error) && (
        <p className="mt-8 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          Couldn&apos;t load your hedges right now{data?.error ? `: ${data.error}` : ""}. Try refreshing in a moment.
        </p>
      )}

      {data && !data.error && hedges.length === 0 && (
        <section className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <p className="text-xl font-bold">No hedges yet</p>
          <p className="mt-1 max-w-md text-text-2">When you approve one, it shows up here with what you paid, what it could pay back, and how it&apos;s doing.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/crypto" className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
              Cushion my crypto
            </Link>
            <Link href="/business" className="rounded-xl border border-border bg-background px-5 py-3 font-semibold hover:border-text-3">
              Reduce a business risk
            </Link>
          </div>
        </section>
      )}

      {data && hedges.length > 0 && (
        <>
          {/* The whole picture at a glance */}
          <section className="mt-8 grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-3" aria-label="Summary">
            <Stat label="Active hedges" value={String(active.length)} note={active.length ? `could pay back up to ${usd(cushion)}` : "none running"} />
            <Stat label="You've put in" value={usd(putIn)} note={`across ${hedges.length} hedge${hedges.length === 1 ? "" : "s"}`} />
            <Stat label="Paid back so far" value={usd(paidBack)} note={finished.length ? `from ${finished.length} finished` : "nothing has settled yet"} />
          </section>

          <section className="mt-10" aria-labelledby="active-h">
            <h2 id="active-h" className="text-xl font-bold tracking-tight">
              Active <span className="font-medium text-text-3">({active.length})</span>
            </h2>
            {active.length === 0 ? (
              <p className="mt-3 text-text-2">Nothing running right now.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {active
                  .sort((a, b) => (o(a)?.settlesAt ?? "").localeCompare(o(b)?.settlesAt ?? ""))
                  .map((h) => (
                    <HedgeCard key={h.id} h={h} o={o(h)} />
                  ))}
              </div>
            )}
          </section>

          {finished.length > 0 && (
            <section className="mt-10" aria-labelledby="finished-h">
              <h2 id="finished-h" className="text-xl font-bold tracking-tight">
                Finished <span className="font-medium text-text-3">({finished.length})</span>
              </h2>
              <p className="mt-1 text-sm text-text-2">Settled by Gemini&apos;s own result for each market.</p>
              <div className="mt-4 space-y-4">
                {finished
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((h) => (
                    <HedgeCard key={h.id} h={h} o={o(h)} />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
