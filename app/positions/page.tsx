"use client";

import { useEffect, useState } from "react";
import type { HedgeOutcome } from "@/lib/hedges/paper";
import type { HedgeRecord } from "@/lib/hedges/store";
import { dateTime, qty, shortDate, usd } from "@/lib/format";
import type { Position } from "@/lib/types";

interface Data {
  mode: string;
  hedges: HedgeRecord[];
  open: Position[];
  settled: Position[];
  outcomes: Record<string, HedgeOutcome>;
  error?: string;
}

function OutcomeLine({ h, o }: { h: HedgeRecord; o?: HedgeOutcome }) {
  if (!o || !o.settled) {
    return <span className="text-text-2 tabular-nums">{usd(h.totalCost)} paid · up to {usd(h.maxPayout)} back · pending</span>;
  }
  if (o.payout > 0) {
    return (
      <span className="tabular-nums">
        <span className="font-medium text-good">✓ Paid out {usd(o.payout)}</span>
        <span className="text-text-2"> · net {o.net! >= 0 ? "+" : "−"}{usd(Math.abs(o.net!))}</span>
      </span>
    );
  }
  return <span className="text-text-2 tabular-nums">Didn&apos;t pay out · {usd(h.totalCost)} spent</span>;
}

function PositionsTable({ rows, settled }: { rows: Position[]; settled: boolean }) {
  return (
    <table className="mt-3 w-full text-sm">
      <thead className="text-left text-xs text-text-3">
        <tr>
          <th className="pb-2 font-normal">Contract</th>
          <th className="font-normal">Side</th>
          <th className="text-right font-normal">Contracts</th>
          <th className="text-right font-normal">Paid</th>
          <th className="text-right font-normal">{settled ? "Paid out" : "Worth now"}</th>
          <th className="text-right font-normal">{settled ? "Result" : "Settles"}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border tabular-nums">
        {rows.map((p) => (
          <tr key={`${p.symbol}-${p.outcome}`}>
            <td className="py-2 pr-2">{p.marketTitle ?? p.symbol}</td>
            <td>{p.outcome.toUpperCase()}</td>
            <td className="text-right">{qty(p.quantity)}</td>
            <td className="text-right">{usd(p.quantity * p.avgPrice)}</td>
            <td className="text-right">
              {settled ? usd(p.payout ?? 0) : p.marketValue === null ? <span className="text-text-3">no bid</span> : usd(p.marketValue)}
            </td>
            <td className="text-right">
              {settled ? (p.payout ? <span className="text-good">✓ Won</span> : <span className="text-text-3">Expired</span>) : p.expiry ? shortDate(p.expiry) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PositionsPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/positions").then((r) => r.json()).then(setData);
  }, []);

  const totals = data
    ? Object.entries(data.outcomes).reduce(
        (t, [id, o]) => {
          const h = data.hedges.find((x) => x.id === id);
          if (o.settled && h) {
            t.paid += h.totalCost;
            t.back += o.payout;
          }
          return t;
        },
        { paid: 0, back: 0 },
      )
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">My hedges</h1>
      {data?.mode === "paper" && (
        <p className="mt-2 inline-block rounded-full bg-warn-bg px-3 py-1 text-xs">Paper trading: live Gemini prices, no real money</p>
      )}
      {!data && <p className="mt-6 text-text-3">Loading…</p>}
      {data?.error && <p className="mt-6 text-bad">{data.error}</p>}

      {data && (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Open</h2>
            {data.open.length === 0 ? <p className="mt-2 text-sm text-text-2">Nothing open right now.</p> : <PositionsTable rows={data.open} settled={false} />}
          </section>

          {data.settled.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-baseline gap-x-4">
                <h2 className="font-semibold">Settled</h2>
                {totals && totals.paid > 0 && (
                  <span className="text-sm text-text-2 tabular-nums">
                    {usd(totals.paid)} paid for hedges · {usd(totals.back)} paid out
                  </span>
                )}
              </div>
              <PositionsTable rows={data.settled} settled />
              <p className="mt-2 text-xs text-text-3">Resolved by Gemini. A hedge that doesn&apos;t pay out usually means the thing you were worried about didn&apos;t happen.</p>
            </section>
          )}

          <section className="mt-6 space-y-3">
            <h2 className="font-semibold">History</h2>
            {data.hedges.length === 0 && <p className="text-sm text-text-2">No hedges approved yet.</p>}
            {data.hedges.map((h) => (
              <article key={h.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{h.title}</span>
                  <span className="text-text-3">{dateTime(h.createdAt)}</span>
                  <span className="ml-auto">
                    <OutcomeLine h={h} o={data.outcomes[h.id]} />
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-3">
                  {h.segment === "business" ? "Business" : "Crypto"} · {h.orders.length} order{h.orders.length === 1 ? "" : "s"}
                  {h.mode === "paper" ? " · paper" : ""}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
