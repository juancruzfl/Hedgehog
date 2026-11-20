"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { LookbackQuery, PastEvent } from "@/lib/lookback/data";
import { etDay, HEDGE_WHEN, triggerPhrase, type HedgeWhen } from "@/lib/lookback/lookback";

// "Try your own": every choice in one compact bar. Changing anything updates the result
// right away (the URL holds the whole query, so a result is still a shareable link).

const field = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";
const label = "mb-1 block text-xs font-medium text-text-2";

export function LookbackControls({ events, initial }: { events: PastEvent[]; initial: LookbackQuery | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = events.find((e) => e.id === initial?.marketId) ?? events.find((e) => e.category === "Sports") ?? events[0];
  const [q, setQ] = useState<LookbackQuery | null>(
    first
      ? { marketId: first.id, symbol: initial?.symbol ?? first.contracts[0]?.symbol ?? "", promo: initial?.promo ?? "Half-price wings", promoCost: initial?.promoCost ?? 3000, when: initial?.when ?? "day" }
      : null,
  );
  const [cost, setCost] = useState(String(q?.promoCost ?? 3000));
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in step when the page loads a different query (back/forward, a shared link).
  const key = initial ? `${initial.marketId}|${initial.symbol}|${initial.promoCost}|${initial.when}|${initial.promo}` : "";
  useEffect(() => {
    if (!initial) return;
    setQ(initial);
    setCost(String(initial.promoCost));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!events.length || !q) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-2">
        No past games or days in the archive yet. Games show up here once they kick off.
      </div>
    );
  }

  const event = events.find((e) => e.id === q.marketId) ?? events[0];
  const go = (next: LookbackQuery, wait = 0) => {
    setQ(next);
    if (typing.current) clearTimeout(typing.current);
    const push = () => {
      const qs = new URLSearchParams({ m: next.marketId, c: next.symbol, cost: String(Math.max(1, Math.round(next.promoCost) || 1)), at: next.when, promo: next.promo.trim() });
      start(() => router.replace(`/lookback?${qs}`, { scroll: false }));
    };
    if (wait) typing.current = setTimeout(push, wait);
    else push();
  };
  const groups = [
    { label: "Games", items: events.filter((e) => e.category === "Sports") },
    { label: "Weather", items: events.filter((e) => e.category === "Weather") },
  ].filter((g) => g.items.length);

  return (
    <section id="try-your-own" aria-label="Try your own" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Try your own</h2>
        <span className={`text-xs text-text-3 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`} aria-live="polite">
          Updating…
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]">
        <label className="block min-w-0">
          <span className={label}>Game or day</span>
          <select
            className={field}
            value={event.id}
            onChange={(e) => {
              const ev = events.find((x) => x.id === e.target.value)!;
              const promo = ev.category === "Weather" && q.promo === "Half-price wings" ? "Free iced coffee" : ev.category === "Sports" && q.promo === "Free iced coffee" ? "Half-price wings" : q.promo;
              go({ ...q, marketId: ev.id, symbol: ev.contracts[0]?.symbol ?? "", promo });
            }}
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {etDay(e.cutoff)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={label}>The promo kicks in if</span>
          <select className={field} value={q.symbol} onChange={(e) => go({ ...q, symbol: e.target.value })}>
            {event.contracts.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {triggerPhrase(event.category, c.label, "future")}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={label}>Your promo</span>
          <input className={field} value={q.promo} maxLength={60} placeholder="Half-price wings" onChange={(e) => go({ ...q, promo: e.target.value }, 500)} />
        </label>
        <label className="block min-w-0">
          <span className={label}>What it costs you</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-3">$</span>
            <input
              className={`${field} pl-6 tabular-nums`}
              inputMode="numeric"
              aria-label="Promo cost in dollars"
              value={cost}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setCost(v);
                if (Number(v) >= 1) go({ ...q, promoCost: Number(v) }, 500);
              }}
            />
          </span>
        </label>
        <label className="block min-w-0">
          <span className={label}>When you&apos;d have hedged</span>
          <select className={field} value={q.when} onChange={(e) => go({ ...q, when: e.target.value as HedgeWhen })}>
            {HEDGE_WHEN.map((w) => (
              <option key={w.value} value={w.value} title={w.sub}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
