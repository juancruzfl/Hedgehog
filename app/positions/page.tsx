"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResultChart } from "@/components/charts";
import { CoinIcon } from "@/components/CoinIcon";
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
type Tab = "active" | "finished";
type Range = "1W" | "1M" | "ALL";

function statusOf(o: HedgeOutcome | undefined): Status {
  if (!o?.settled) return "active";
  if (o.net !== null && o.payout > 0) return o.net >= 0 ? "paid" : "partial";
  return "unused";
}

const created = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`;
const tone = (n: number) => (n > 0.005 ? "text-good" : n < -0.005 ? "text-bad" : "text-text-2");

/** A hedge's result so far: settled → paid back − cost; active → worth today − cost (0 if there's no bid). */
function resultOf(h: HedgeRecord, o: HedgeOutcome | undefined): number {
  if (o?.settled) return o.payout - h.totalCost;
  return o?.worthNow == null ? 0 : o.worthNow - h.totalCost;
}

/* ---------- Header cards ---------- */

const RANGES: { value: Range; label: string; ms: number }[] = [
  { value: "1W", label: "past week", ms: 7 * 864e5 },
  { value: "1M", label: "past month", ms: 30 * 864e5 },
  { value: "ALL", label: "all time", ms: Infinity },
];

/**
 * Running overall result over time. Settled hedges add their result on the day they settle;
 * active hedges only have today's bid, so the last point marks them to it.
 */
function resultSeries(hedges: HedgeRecord[], o: (h: HedgeRecord) => HedgeOutcome | undefined, now: number, range: Range) {
  const events = hedges
    .filter((h) => o(h)?.settled)
    .map((h) => {
      const at = Date.parse(o(h)?.settlesAt ?? "");
      return { ts: Math.min(Number.isFinite(at) ? at : now, now), d: resultOf(h, o(h)) };
    })
    .sort((a, b) => a.ts - b.ts);
  const end = hedges.reduce((s, h) => s + resultOf(h, o(h)), 0);
  const first = Math.min(...hedges.map((h) => h.createdAt));
  const span = RANGES.find((r) => r.value === range)!.ms;
  const start = Math.max(first, now - span);

  let v = 0;
  for (const e of events) if (e.ts <= start) v += e.d;
  const startValue = v;
  const points = [{ ts: start, value: v }];
  for (const e of events)
    if (e.ts > start) {
      v += e.d;
      points.push({ ts: e.ts, value: v });
    }
  points.push({ ts: now, value: end });
  return { points, change: end - startValue };
}

function ValueCard({ worth, cushion, activeCount, hasUnpriced, paper }: { worth: number; cushion: number; activeCount: number; hasUnpriced: boolean; paper: boolean }) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-label="Your hedges today">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-2">Hedges worth today</p>
        {paper && <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-[11px] font-medium text-warn">Paper · no real money</span>}
      </div>
      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{usd(worth, 2)}</p>
      <p className="mt-1 text-sm text-text-3">
        {activeCount
          ? `${activeCount} active · if you sold them now${hasUnpriced ? " (some have no buyer right now)" : ""}`
          : "Nothing running right now"}
      </p>

      <div className="mt-5 rounded-xl bg-surface-2 px-4 py-3">
        <p className="text-xs text-text-2">Could pay back up to</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums">{usd(cushion)}</p>
        <p className="text-xs text-text-3">if what you&apos;re worried about happens</p>
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <Link href="/crypto" className="flex-1 whitespace-nowrap rounded-xl bg-accent px-3 py-2.5 text-center text-sm font-semibold text-accent-ink hover:brightness-110">
          Cushion my crypto
        </Link>
        <Link href="/business" className="flex-1 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm font-semibold hover:border-text-3">
          Business risk
        </Link>
      </div>
    </section>
  );
}

function ResultCard({ hedges, o, now }: { hedges: HedgeRecord[]; o: (h: HedgeRecord) => HedgeOutcome | undefined; now: number }) {
  const [range, setRange] = useState<Range>("ALL");
  const { points, change } = useMemo(() => resultSeries(hedges, o, now, range), [hedges, o, now, range]);
  const label = RANGES.find((r) => r.value === range)!.label;
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-label="Overall result">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-2">Overall result</p>
        <div role="radiogroup" aria-label="Time range" className="flex rounded-lg bg-surface-2 p-0.5 text-xs font-semibold">
          {RANGES.map((r) => (
            <button
              key={r.value}
              role="radio"
              aria-checked={range === r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-2.5 py-1 transition ${range === r.value ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text"}`}
            >
              {r.value === "ALL" ? "All" : r.value}
            </button>
          ))}
        </div>
      </div>
      <p className={`mt-2 text-4xl font-bold tracking-tight tabular-nums ${tone(change)}`}>{signed(change)}</p>
      <p className="mt-1 text-sm text-text-3">{label} · paid back plus worth today, minus what you paid</p>
      <div className="mt-auto pt-4">
        <ResultChart data={points} tone={change > 0.005 ? "good" : change < -0.005 ? "bad" : "flat"} />
      </div>
      <p className="mt-2 text-xs text-text-3">A hedge that isn&apos;t needed costs a little. That&apos;s the good outcome: you paid for peace of mind.</p>
    </section>
  );
}

/* ---------- Rows ---------- */

const COIN = /\b(BTC|Bitcoin|ETH|Ethereum|SOL|Solana|XRP|ZEC|Zcash|HYPE|Hyperliquid)\b/i;
const COIN_SYMBOL: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", zcash: "ZEC", hyperliquid: "HYPE" };

function HedgeIcon({ h }: { h: HedgeRecord }) {
  const m = h.segment !== "business" ? h.title.match(COIN) : null;
  if (m) return <CoinIcon asset={COIN_SYMBOL[m[1].toLowerCase()] ?? m[1]} size="md" />;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {h.segment === "business" ? (
          <>
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </>
        ) : (
          <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
        )}
      </svg>
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (status === "active")
    return (
      <span className={`${base} bg-accent-soft text-accent`}>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        Active
      </span>
    );
  if (status === "paid") return <span className={`${base} bg-good-soft text-good`}>✓ Paid out</span>;
  if (status === "partial") return <span className={`${base} bg-good-soft text-good`}>✓ Paid out part</span>;
  return <span className={`${base} bg-surface-2 text-text-2`}>Not needed</span>;
}

// Shared column template so the header and every row line up.
const COLS = "sm:grid sm:grid-cols-[minmax(0,1fr)_96px_128px_128px_104px_20px] sm:items-center sm:gap-4";

function Cell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`tabular-nums sm:text-right ${className}`}>
      <p className="text-[11px] text-text-3 sm:hidden">{label}</p>
      {children}
    </div>
  );
}

function HedgeRow({ h, o, tab }: { h: HedgeRecord; o?: HedgeOutcome; tab: Tab }) {
  const status = statusOf(o);
  const legs = o?.legs ?? [];
  const result = resultOf(h, o);
  const pctOf = h.totalCost > 0 ? ` (${Math.round((Math.abs(result) / h.totalCost) * 100)}%)` : "";

  return (
    <details className="group border-t border-border first:border-t-0">
      <summary className={`cursor-pointer list-none px-4 py-4 transition hover:bg-surface-2/60 sm:px-5 [&::-webkit-details-marker]:hidden ${COLS}`}>
        {/* Hedge */}
        <div className="flex min-w-0 items-center gap-3">
          <HedgeIcon h={h} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-snug">{h.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-3">
              <StatusPill status={status} />
              <span>
                {h.segment === "business" ? "Business" : "Crypto"} · {legs.length || h.orders.length} order
                {(legs.length || h.orders.length) === 1 ? "" : "s"} · approved {created(h.createdAt)}
              </span>
              <Link href={`/receipt/${h.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-accent hover:underline">
                Receipt
              </Link>
            </p>
          </div>
        </div>

        {/* Numbers: a 2×2 grid on phones, columns on desktop */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:contents">
          <Cell label="You paid">
            <p className="font-medium">{usd(h.totalCost, 2)}</p>
          </Cell>
          {tab === "active" ? (
            <>
              <Cell label="Worth today">
                <p className="font-semibold">{o?.worthNow == null ? "—" : usd(o.worthNow, 2)}</p>
                <p className={`text-xs ${o?.worthNow == null ? "text-text-3" : tone(result)}`}>
                  {o?.worthNow == null ? "no buyer now" : `${signed(result)}${pctOf}`}
                </p>
              </Cell>
              <Cell label="Pays back up to">
                <p className="font-medium">{usd(h.maxPayout)}</p>
                <p className="text-xs text-text-3">if it happens</p>
              </Cell>
              <Cell label="Settles">
                <p className="font-medium">{o?.settlesAt ? shortDate(o.settlesAt) : "—"}</p>
                <p className="text-xs text-text-3">{o?.settlesAt ? timeUntil(o.settlesAt) : "when it resolves"}</p>
              </Cell>
            </>
          ) : (
            <>
              <Cell label="Paid back">
                <p className="font-semibold">{usd(o?.payout ?? 0, 2)}</p>
                <p className="text-xs text-text-3">{o?.payout ? "paid by Gemini" : "nothing owed"}</p>
              </Cell>
              <Cell label="Result">
                <p className={`font-semibold ${tone(result)}`}>{signed(result)}</p>
                <p className="text-xs text-text-3">{status === "unused" ? "cost of the cushion" : "after what you paid"}</p>
              </Cell>
              <Cell label="Settled">
                <p className="font-medium">{o?.settlesAt ? shortDate(o.settlesAt) : "—"}</p>
              </Cell>
            </>
          )}
        </div>

        <svg
          viewBox="0 0 20 20"
          className="hidden h-4 w-4 justify-self-end text-text-3 transition group-open:rotate-180 sm:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      {/* Details: what happens next and the actual orders */}
      <div className="bg-surface-2/50 px-4 pb-4 pt-3 text-sm sm:px-5 sm:pl-[4.25rem]">
        <p className="text-text-2">
          {status === "active"
            ? `Settles ${o?.settlesAt ? `${shortDate(o.settlesAt)} (${timeUntil(o.settlesAt)})` : "when the market resolves"}. Gemini pays out automatically if it happens; nothing for you to do.`
            : status === "unused"
              ? "What you were worried about didn't happen, so the hedge expired. That's the good outcome: you only paid for peace of mind."
              : "It happened, and the hedge paid out to soften the hit."}
        </p>
        {legs.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-3">
              The order{legs.length === 1 ? "" : "s"} on Gemini
            </p>
            <ul className="mt-1 divide-y divide-border tabular-nums">
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
          </>
        )}
      </div>
    </details>
  );
}

/* ---------- Page ---------- */

const SORTS: Record<Tab, { value: string; label: string; cmp: (a: Sortable, b: Sortable) => number }[]> = {
  active: [
    { value: "settles", label: "Settles soonest", cmp: (a, b) => (a.o?.settlesAt ?? "~").localeCompare(b.o?.settlesAt ?? "~") },
    { value: "worth", label: "Worth today", cmp: (a, b) => (b.o?.worthNow ?? -1) - (a.o?.worthNow ?? -1) },
    { value: "payback", label: "Pays back most", cmp: (a, b) => b.h.maxPayout - a.h.maxPayout },
    { value: "newest", label: "Newest", cmp: (a, b) => b.h.createdAt - a.h.createdAt },
  ],
  finished: [
    { value: "newest", label: "Newest", cmp: (a, b) => (b.o?.settlesAt ?? "").localeCompare(a.o?.settlesAt ?? "") || b.h.createdAt - a.h.createdAt },
    { value: "result", label: "Best result", cmp: (a, b) => resultOf(b.h, b.o) - resultOf(a.h, a.o) },
    { value: "paid", label: "Paid back most", cmp: (a, b) => (b.o?.payout ?? 0) - (a.o?.payout ?? 0) },
  ],
};
interface Sortable {
  h: HedgeRecord;
  o?: HedgeOutcome;
}

export default function PositionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Record<Tab, string>>({ active: "settles", finished: "newest" });

  useEffect(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then((d: Data) => {
        setNow(Date.now());
        setData(d);
      })
      .catch(() => setFailed(true));
  }, []);

  const hedges = useMemo(() => data?.hedges ?? [], [data]);
  const o = useMemo(() => (h: HedgeRecord) => data?.outcomes[h.id], [data]);
  const active = hedges.filter((h) => statusOf(o(h)) === "active");
  const finished = hedges.filter((h) => statusOf(o(h)) !== "active");
  const worth = active.reduce((s, h) => s + (o(h)?.worthNow ?? 0), 0);
  const hasUnpriced = active.some((h) => o(h)?.worthNow == null);
  const cushion = active.reduce((s, h) => s + h.maxPayout, 0);

  const q = query.trim().toLowerCase();
  const sorter = SORTS[tab].find((s) => s.value === sort[tab]) ?? SORTS[tab][0];
  const rows = (tab === "active" ? active : finished)
    .filter((h) => !q || h.title.toLowerCase().includes(q) || (o(h)?.legs ?? []).some((l) => l.market.toLowerCase().includes(q)))
    .map((h) => ({ h, o: o(h) }))
    .sort(sorter.cmp);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      {/* No visible heading (the nav already says "My hedges"); screen readers still get one. */}
      <h1 className="sr-only">My hedges</h1>

      {!data && !failed && (
        <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading your hedges">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
            <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
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
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ValueCard worth={worth} cushion={cushion} activeCount={active.length} hasUnpriced={hasUnpriced} paper={data.mode === "paper"} />
            <ResultCard hedges={hedges} o={o} now={now} />
          </div>

          <section className="mt-8 rounded-2xl border border-border bg-surface" aria-label="Your hedges">
            {/* Tabs + search + sort */}
            <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
              <div role="tablist" aria-label="Hedges" className="flex gap-5">
                {(
                  [
                    ["active", "Active", active.length],
                    ["finished", "Finished", finished.length],
                  ] as const
                ).map(([value, label, n]) => (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition ${
                      tab === value ? "border-text text-text" : "border-transparent text-text-3 hover:text-text"
                    }`}
                  >
                    {label} <span className="font-medium text-text-3">{n}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pb-3">
                <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <span className="sr-only">Search hedges</span>
                  <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="9" cy="9" r="5.5" />
                    <path d="m13.5 13.5 3 3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
                  />
                </label>
                <label>
                  <span className="sr-only">Sort by</span>
                  <select
                    value={sorter.value}
                    onChange={(e) => setSort((s) => ({ ...s, [tab]: e.target.value }))}
                    className="h-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    {SORTS[tab].map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Column headings (desktop) */}
            <div className={`hidden border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3 ${COLS}`} aria-hidden>
              <span>Hedge</span>
              <span className="text-right">You paid</span>
              <span className="text-right">{tab === "active" ? "Worth today" : "Paid back"}</span>
              <span className="text-right">{tab === "active" ? "Pays back up to" : "Result"}</span>
              <span className="text-right">{tab === "active" ? "Settles" : "Settled"}</span>
              <span />
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-text-2">
                {q ? `No ${tab} hedges match “${query.trim()}”.` : tab === "active" ? "Nothing running right now." : "Nothing has settled yet."}
              </p>
            ) : (
              <div>
                {rows.map(({ h, o }) => (
                  <HedgeRow key={h.id} h={h} o={o} tab={tab} />
                ))}
              </div>
            )}
          </section>
          {tab === "finished" && finished.length > 0 && (
            <p className="mt-3 text-xs text-text-3">Settled by Gemini&apos;s own result for each market.</p>
          )}
        </>
      )}
    </main>
  );
}
