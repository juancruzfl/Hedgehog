"use client";

import { useEffect, useState } from "react";
import type { HedgeRecord } from "@/lib/hedges/store";
import { dateTime, qty, shortDate, usd } from "@/lib/format";
import type { Position } from "@/lib/types";

export default function PositionsPage() {
  const [data, setData] = useState<{ mode: string; hedges: HedgeRecord[]; positions: Position[]; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/positions").then((r) => r.json()).then(setData);
  }, []);

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
            <h2 className="font-semibold">Open positions</h2>
            {data.positions.length === 0 ? (
              <p className="mt-2 text-sm text-text-2">Nothing yet.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs text-text-3">
                  <tr><th className="pb-2 font-normal">Contract</th><th className="font-normal">Side</th><th className="text-right font-normal">Contracts</th><th className="text-right font-normal">Paid</th><th className="text-right font-normal">Worth now</th><th className="text-right font-normal">Settles</th></tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {data.positions.map((p) => (
                    <tr key={`${p.symbol}-${p.outcome}`}>
                      <td className="py-2">{p.marketTitle ?? p.symbol}</td>
                      <td>{p.outcome.toUpperCase()}</td>
                      <td className="text-right">{qty(p.quantity)}</td>
                      <td className="text-right">{usd(p.quantity * p.avgPrice)}</td>
                      <td className="text-right">{p.marketValue === null ? <span className="text-text-3">no bid</span> : usd(p.marketValue)}</td>
                      <td className="text-right">{p.expiry ? shortDate(p.expiry) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="font-semibold">History</h2>
            {data.hedges.length === 0 && <p className="text-sm text-text-2">No hedges approved yet.</p>}
            {data.hedges.map((h) => (
              <article key={h.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{h.title}</span>
                  <span className="text-text-3">{dateTime(h.createdAt)}</span>
                  <span className="ml-auto tabular-nums">{usd(h.totalCost)} paid · up to {usd(h.maxPayout)} back</span>
                </div>
                <p className="mt-1 text-xs text-text-3">{h.orders.length} order{h.orders.length === 1 ? "" : "s"} · {h.status}{h.mode === "paper" ? " · paper" : ""}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
