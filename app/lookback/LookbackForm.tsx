"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Segmented } from "@/components/ui";
import type { LookbackQuery, PastEvent } from "@/lib/lookback/data";
import { etDay, HEDGE_WHEN, triggerPhrase, type HedgeWhen, type LookbackCategory } from "@/lib/lookback/lookback";

const TABS: { value: LookbackCategory; label: string }[] = [
  { value: "Sports", label: "Games" },
  { value: "Weather", label: "Weather" },
];

const label = "text-sm font-medium";
const input = "mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

/** Pick a past game or day, the outcome that triggers the promo, its cost and when to hedge. Submits to the URL. */
export function LookbackForm({ events, initial }: { events: PastEvent[]; initial: LookbackQuery | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = events.find((e) => e.id === initial?.marketId) ?? events.find((e) => e.category === "Sports") ?? events[0];
  const [tab, setTab] = useState<LookbackCategory>(first?.category ?? "Sports");
  const [eventId, setEventId] = useState(first?.id ?? "");
  const [symbol, setSymbol] = useState(initial?.symbol ?? first?.contracts[0]?.symbol ?? "");
  const [promo, setPromo] = useState(initial?.promo ?? "Half-price wings");
  const [cost, setCost] = useState(String(initial?.promoCost ?? 1200));
  const [when, setWhen] = useState<HedgeWhen>(initial?.when ?? "day");
  const [filter, setFilter] = useState("");

  const shown = useMemo(
    () => events.filter((e) => e.category === tab && (!filter || e.name.toLowerCase().includes(filter.toLowerCase()))),
    [events, tab, filter],
  );
  const event = events.find((e) => e.id === eventId);

  function pick(e: PastEvent) {
    setEventId(e.id);
    setSymbol(e.contracts[0]?.symbol ?? "");
    if (e.category === "Weather" && promo === "Half-price wings") setPromo("Free iced coffee");
    if (e.category === "Sports" && promo === "Free iced coffee") setPromo("Half-price wings");
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!event || !symbol) return;
    const qs = new URLSearchParams({ m: event.id, c: symbol, cost: String(Math.max(1, Math.round(Number(cost) || 0))), at: when, promo: promo.trim() });
    start(() => router.push(`/lookback?${qs}`, { scroll: false }));
  }

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-2">
        No past games or days in the archive yet. Hedgehog started recording on Nov 17, 2026; games show up here once they kick off.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="min-w-0 space-y-6 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className={label}>1. The game or day your promo depended on</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Segmented label="Kind of event" options={TABS} value={tab} onChange={(v) => setTab(v)} />
          <input aria-label="Search" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} size={8} className={`${input} mt-0 w-auto min-w-0 flex-1`} />
        </div>
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border" aria-label="Past events">
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-text-3">Nothing matches.</li>}
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => pick(e)}
                aria-pressed={e.id === eventId}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2 ${e.id === eventId ? "bg-accent-soft" : ""}`}
              >
                <span className="w-16 shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide text-text-2">{e.badge}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                <span className="shrink-0 text-xs text-text-3">{etDay(e.cutoff)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {event && (
        <div>
          <p className={label}>2. The promo kicks in if…</p>
          <div className="mt-2">
            <Segmented
              label="What triggers the promo"
              options={event.contracts.map((c) => ({ value: c.symbol, label: triggerPhrase(event.category, c.label, "future") }))}
              value={symbol}
              onChange={setSymbol}
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block">
          <span className={label}>3. Your promo</span>
          <input value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={60} placeholder="Half-price wings" className={input} />
        </label>
        <label className="block">
          <span className={label}>What it costs you</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-text-3">$</span>
            <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" aria-label="Promo cost in dollars" className={`${input} pl-6 tabular-nums`} />
          </span>
        </label>
      </div>

      <div>
        <p className={label}>4. When you&apos;d have hedged</p>
        <div className="mt-2">
          <Segmented label="When to hedge" options={HEDGE_WHEN} value={when} onChange={setWhen} />
        </div>
      </div>

      <button
        type="submit"
        disabled={!event || !symbol || !Number(cost) || pending}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Looking back…" : "Look back"}
      </button>
    </form>
  );
}
