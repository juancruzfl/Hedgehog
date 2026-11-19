"use client";

import Link from "next/link";
import { useState } from "react";
import { BusinessIcon } from "@/components/BusinessIcon";
import { CoinIcon } from "@/components/CoinIcon";
import { usd } from "@/lib/format";

// "What could hurt you?": two tiles, one per way in. A title and a line of text on top,
// a small working illustration of that flow at the bottom.

export interface CoinRow {
  asset: string; // SOL
  name: string; // Solana
  spot: string; // "$74.79"
  by: string; // "Nov 20"
  ladder: { drop: number; strike: number; chance: number }[];
}

function Tile({ href, title, body, cta, children }: { href: string; title: string; body: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl bg-surface-2 lg:min-h-[560px]">
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <h3 className="text-xl font-medium">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h3>
        <p className="mt-1 max-w-md text-[15px] leading-snug text-text-2">{body}</p>
        <Link href={href} className="group mt-3 inline-block text-sm font-medium text-accent">
          {cta} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-8 pt-6 sm:px-8">{children}</div>
    </div>
  );
}

/** Pick a coin, see how far it would have to fall at each level and how likely that is. */
function DropLadder({ coins }: { coins: CoinRow[] }) {
  const [asset, setAsset] = useState(coins.find((c) => c.asset === "SOL")?.asset ?? coins[0]?.asset);
  const coin = coins.find((c) => c.asset === asset);
  if (!coin) return null;
  // Falling below a lower price can't be likelier than falling below a higher one; thin
  // markets sometimes quote it that way, so each level is capped at the one above it.
  let cap = 1;
  const ladder = [...coin.ladder]
    .sort((a, b) => b.strike - a.strike)
    .map((l) => {
      cap = Math.min(cap, l.chance);
      return { ...l, chance: cap };
    });
  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(12,10,8,0.06)]">
      <div className="flex gap-2" role="tablist" aria-label="Coin">
        {coins.map((c) => (
          <button
            key={c.asset}
            role="tab"
            aria-selected={c.asset === asset}
            onClick={() => setAsset(c.asset)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              c.asset === asset ? "bg-text text-surface" : "bg-surface-2 text-text-2 hover:text-text"
            }`}
          >
            <CoinIcon asset={c.asset} size="sm" className="!h-5 !w-5" />
            {c.asset}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-[15px] text-text-2">{coin.name} now</p>
        <p className="text-2xl font-semibold tabular-nums">{coin.spot}</p>
      </div>
      <p className="text-right text-xs text-text-3">chance it closes lower by {coin.by}</p>

      {/* The ladder: a falling line with each drop level hanging off it */}
      <ol className="relative mt-3 space-y-4 border-l border-dashed border-text-3/40 pl-4">
        {ladder.map((l) => (
          <li key={l.drop} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-bad" aria-hidden />
            <div className="flex items-baseline justify-between gap-3 text-[15px] tabular-nums">
              <span className="w-12 text-text-3">−{Math.round(l.drop * 100)}%</span>
              <span className="flex-1 font-semibold text-bad">{usd(l.strike, l.strike < 100 ? 2 : 0)}</span>
              <span className="font-medium">{Math.round(l.chance * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-bad-soft">
              <div className="h-full rounded-full bg-bad" style={{ width: `${Math.max(2, Math.round(l.chance * 100))}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const EVENTS = [
  { day: 3, dayName: "Thu", who: "Sports bar", what: "Half-price wings if we win", worst: 3000 },
  { day: 5, dayName: "Sat", who: "Food truck", what: "Slow patio if it's under 50°F", worst: 800 },
  { day: 0, dayName: "Mon", who: "Delivery fleet", what: "Diesel bill if fuel jumps", worst: 400 },
];
const HEDGED = 860; // what offsetting all three would cost: the known cost of the week

/** A week with its risky days marked, and what the week costs with and without hedges. */
function WeekPlanner() {
  const worst = EVENTS.reduce((s, e) => s + e.worst, 0);
  const marked = new Set(EVENTS.map((e) => e.day));
  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(12,10,8,0.06)]">
      <p className="text-base font-medium">Your week</p>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-xs">
        {WEEK.map((d, k) => (
          <div key={k} className={`rounded-md py-1.5 ${marked.has(k) ? "bg-warn-bg font-semibold text-warn" : "bg-surface-2 text-text-3"}`}>
            {d}
            <span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${marked.has(k) ? "bg-warn" : "bg-transparent"}`} aria-hidden />
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {EVENTS.map((e) => (
          <li key={e.dayName} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <BusinessIcon who={e.who} className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{e.dayName}</p>
              <p className="truncate text-sm leading-tight">{e.what}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-bad">−{usd(e.worst)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-border pt-5 text-center">
        <div className="rounded-lg bg-bad-soft px-2 py-2">
          <p className="text-[11px] text-text-2">Worst case</p>
          <p className="text-lg font-semibold tabular-nums text-bad">−{usd(worst)}</p>
        </div>
        <div className="rounded-lg bg-accent-soft px-2 py-2">
          <p className="text-[11px] text-text-2">Hedged, known cost</p>
          <p className="text-lg font-semibold tabular-nums text-accent">{usd(HEDGED)}</p>
        </div>
      </div>
    </div>
  );
}

export function RiskTiles({ coins }: { coins: CoinRow[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Tile href="/crypto" title="Know your coins' downside" body="Paste a wallet or type what you hold. See how likely a 5%, 10% or 20% drop is before the day or week ends." cta="Check my crypto">
        <DropLadder coins={coins} />
      </Tile>
      <Tile
        href="/business"
        title="Turn a risky week into a known cost"
        body="Describe a promo, a fuel bill or a weather worry. Hedgehog finds the market, checks the fine print and prices the hedge."
        cta="Reduce a business risk"
      >
        <WeekPlanner />
      </Tile>
    </div>
  );
}
