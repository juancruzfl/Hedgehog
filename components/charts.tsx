"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { timeTicks } from "@/lib/chart-ticks";
import { dateTime, pct, usd } from "@/lib/format";

// Colors come from CSS tokens so light/dark are both selected values.
const C = {
  accent: "var(--accent)",
  neutral: "var(--neutral-series)",
  grid: "var(--grid)",
  text2: "var(--text-2)",
  text3: "var(--text-3)",
};

const axisTick = { fill: C.text3, fontSize: 11 };

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs" style={{ color: "var(--text)" }}>
      {children}
    </div>
  );
}

/** Odds over time for one strike (single series: no legend; the caption names it). */
export function OddsSparkline({ data }: { data: { ts: number; probBelow: number }[] }) {
  return (
    <div className="h-12 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          {/* Floor the scale at 10 pts so a 1-pt wiggle on a 6% market doesn't look like a spike. */}
          <YAxis hide domain={[0, (max: number) => Math.max(max * 1.3, 0.1)]} />
          <XAxis hide dataKey="ts" type="number" domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: C.text3, strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipBox>
                  <div className="text-text-3">{dateTime(payload[0].payload.ts)}</div>
                  <div className="font-medium">{pct(payload[0].payload.probBelow, 1)} chance</div>
                </TooltipBox>
              ) : null
            }
          />
          <Line type="monotone" dataKey="probBelow" stroke={C.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface CurvePoint {
  price: number;
  unhedged: number;
  hedged: number;
}

/** P&L at expiry vs settlement price: hedged (accent) vs no hedge (neutral, dashed). */
export function PayoffChart({
  data,
  spot,
  asset,
  caption = "Your gain or loss on this holding at expiry, including what the hedge costs. Hover to compare any price.",
}: {
  data: CurvePoint[];
  spot: number;
  asset: string;
  caption?: string;
}) {
  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-text-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: C.accent }} /> With Hedgehog
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: C.neutral }} /> Without
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 12, bottom: 20, left: 8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis
              dataKey="price"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={axisTick}
              tickFormatter={(v) => usd(v, v >= 100 ? 0 : 2)}
              stroke={C.grid}
              label={{ value: `${asset} price at expiry`, position: "insideBottom", offset: -12, fill: C.text3, fontSize: 11 }}
            />
            <YAxis tick={axisTick} tickFormatter={(v) => usd(v, 0)} stroke={C.grid} width={72} />
            <ReferenceLine y={0} stroke={C.text3} strokeWidth={1} />
            <ReferenceLine x={spot} stroke={C.text3} strokeDasharray="2 4" label={{ value: "today", fill: C.text3, fontSize: 11, position: "top" }} />
            <Tooltip
              cursor={{ stroke: C.text3, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as CurvePoint | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox>
                    <div className="mb-1 text-text-3">If {asset} ends at {usd(p.price)}</div>
                    <div>With Hedgehog: <span className="font-medium">{usd(p.hedged)}</span></div>
                    <div>Without: <span className="font-medium">{usd(p.unhedged)}</span></div>
                  </TooltipBox>
                );
              }}
            />
            <Line type="linear" dataKey="unhedged" stroke={C.neutral} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="hedged" stroke={C.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-text-3">{caption}</figcaption>
    </figure>
  );
}

export interface OddsSeries {
  key: string;
  label: string; // e.g. "Below $65 (−10%)"
  data: { ts: number; probBelow: number }[];
}

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

// The collector records every 5 minutes; a longer silence (e.g. exchange maintenance)
// is drawn as a break in the line rather than a straight bridge across it.
const GAP_MS = 20 * 60_000;
/** How the market's odds moved over time, one line per price level (max 3, fixed color order). */
export function OddsHistoryChart({ series, title, fill = false }: { series: OddsSeries[]; title: string; fill?: boolean }) {
  const shown = series.slice(0, 3);
  // Collector snapshots share timestamps across contracts, so rows merge cleanly by ts.
  const rows = new Map<number, Record<string, number>>();
  shown.forEach((s, i) => {
    for (const p of s.data) {
      const row = rows.get(p.ts) ?? { ts: p.ts };
      row[`s${i}`] = p.probBelow;
      rows.set(p.ts, row);
    }
  });
  const sorted = [...rows.values()].sort((a, b) => a.ts - b.ts);
  // A row of nulls inside each long silence breaks the line there.
  const data: Record<string, number | null>[] = [];
  let gaps = 0;
  sorted.forEach((r, k) => {
    const prev = sorted[k - 1];
    if (prev && r.ts - prev.ts > GAP_MS) {
      gaps++;
      data.push({ ts: prev.ts + 1, ...Object.fromEntries(shown.map((_, i) => [`s${i}`, null])) });
    }
    data.push(r);
  });
  const last = data.length - 1;
  // Clean y ticks: pick a step that gives at most ~5 ticks.
  const maxVal = Math.max(0.01, ...sorted.flatMap((r) => shown.map((_, i) => r[`s${i}`] ?? 0)));
  const step = [0.02, 0.05, 0.1, 0.2, 0.25].find((st) => Math.ceil((maxVal + 0.01) / st) <= 5) ?? 0.25;
  const top = Math.min(1, Math.ceil((maxVal + 0.01) / step) * step);
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  const t0 = sorted[0]?.ts ?? 0;
  const t1 = sorted.at(-1)?.ts ?? 0;
  const { ticks, stepH } = timeTicks(t0, t1);
  // Hour ticks read "7 PM"; a tick at midnight (or day steps) reads the date instead.
  const tickFmt = (ts: number) => {
    const d = new Date(ts);
    return stepH >= 24 || (d.getHours() === 0 && d.getMinutes() === 0)
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleTimeString("en-US", { hour: "numeric" });
  };

  return (
    <figure className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      {title && <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>}
      {/* One line needs no key: the card's title already says what it is. */}
      {shown.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-text-2">
          {shown.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: SERIES[i] }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <div className={fill ? "min-h-56 w-full flex-1" : "h-56 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 56, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="ts" type="number" scale="time" domain={[t0, t1]} ticks={ticks} tick={axisTick} tickFormatter={tickFmt} stroke={C.grid} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={axisTick} tickFormatter={(v) => pct(v)} stroke={C.grid} width={44} domain={[0, top]} ticks={yTicks} />
            <Tooltip
              cursor={{ stroke: C.text3, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Record<string, number | null> | undefined;
                if (!active || !row || shown.every((_, i) => row[`s${i}`] == null)) return null;
                return (
                  <TooltipBox>
                    <div className="mb-1 text-text-3">{dateTime(row.ts!)}</div>
                    {shown.map((s, i) =>
                      row[`s${i}`] == null ? null : (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[i] }} />
                          {s.label}: <span className="font-medium">{pct(row[`s${i}`]!, 1)}</span>
                        </div>
                      ),
                    )}
                  </TooltipBox>
                );
              }}
            />
            {shown.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={`s${i}`}
                stroke={SERIES[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                connectNulls={false}
                isAnimationActive={false}
                label={(raw: unknown) => {
                  const p = raw as { index?: number; x?: number | string; y?: number | string; value?: number | string };
                  if (p.index !== last || p.value === undefined) return <g key={`lbl-${s.key}-${p.index}`} />;
                  return (
                    <text key={`lbl-${s.key}`} x={Number(p.x) + 6} y={Number(p.y)} dy={4} fontSize={11} fill="var(--text-2)">
                      {pct(Number(p.value))}
                    </text>
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-text-3">
        Market-implied chance. Data provided by Gemini, recorded every 5 minutes by Hedgehog and{" "}
        <a href="/archive" className="underline hover:text-text">
          sealed on Solana
        </a>
        .
        {gaps > 0 && " Breaks in the line are times with no readings, such as exchange maintenance."}
      </p>
    </figure>
  );
}

/** Running overall result of the user's hedges (paid back + worth today − put in), with a dashed break-even line. */
export function ResultChart({ data, tone }: { data: { ts: number; value: number }[]; tone: "good" | "bad" | "flat" }) {
  const stroke = tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : C.accent;
  return (
    <div className="h-28 w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 2, bottom: 2, left: 2 }}>
          <XAxis hide dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} />
          {/* Always include $0 so "break-even" is on screen and small moves don't look like cliffs. */}
          <YAxis hide domain={[(min: number) => Math.min(0, min) * 1.15, (max: number) => Math.max(0, max) * 1.15 || 1]} />
          <ReferenceLine y={0} stroke={C.text3} strokeDasharray="3 4" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: C.text3, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { ts: number; value: number } | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox>
                  <div className="text-text-3">{dateTime(p.ts)}</div>
                  <div className="font-medium">
                    {p.value >= 0 ? "+" : "−"}
                    {usd(Math.abs(p.value))} overall
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={stroke}
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface MarketLine {
  key: string;
  label: string;
  prob: number; // chance now
  data: { ts: number; p: number }[];
  featured: boolean;
}

const MARKET_COLORS = ["var(--series-2)", "var(--series-1)"];
const monoTick = { fill: C.text3, fontSize: 10.5, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" };
// Fixed geometry so the HTML pills on the right line up with the plot.
const MC = { height: 248, top: 14, axis: 26, pillH: 24, gap: 4 };
/** MarketChart's height, for placeholders that stand in for it. */
export const MARKET_CHART_HEIGHT = MC.height;

/**
 * A market's levels over time, laid out like Gemini's market chart: one line per level,
 * dashed guide lines, monospace axes, and each level's current chance in a pill on the right.
 */
export function MarketChart({ lines }: { lines: MarketLine[] }) {
  // Wide enough for the longest label ("Indianapolis") in 11px mono, plus dot and percent.
  const pillW = Math.min(150, 58 + Math.max(...lines.map((l) => l.label.replace(/^(Below|Above) /, "").length)) * 7);
  const color = (k: number) => (lines[k].featured ? "var(--accent)" : MARKET_COLORS[lines.slice(0, k).filter((l) => !l.featured).length % 2]);
  const rows = new Map<number, Record<string, number>>();
  lines.forEach((l, k) => {
    for (const d of l.data) {
      const row = rows.get(d.ts) ?? { ts: d.ts };
      row[`l${k}`] = d.p;
      rows.set(d.ts, row);
    }
  });
  const data = [...rows.values()].sort((a, b) => a.ts - b.ts);
  const maxVal = Math.max(0.05, ...lines.flatMap((l) => [l.prob, ...l.data.map((d) => d.p)]));
  const step = [0.05, 0.1, 0.2, 0.25].find((st) => Math.ceil((maxVal + 0.02) / st) <= 4) ?? 0.25;
  const top = Math.min(1, Math.ceil((maxVal + 0.02) / step) * step);
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  const t0 = data[0]?.ts ?? 0;
  const t1 = data.at(-1)?.ts ?? 0;
  const { ticks, stepH } = timeTicks(t0, t1);
  const tickFmt = (ts: number) => {
    const d = new Date(ts);
    return stepH >= 24 || (d.getHours() === 0 && d.getMinutes() === 0)
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleTimeString("en-US", { hour: "numeric" });
  };

  // Pills sit at each line's current level, nudged apart so they never overlap.
  const plotH = MC.height - MC.top - MC.axis;
  const pills = lines
    .map((l, k) => ({ l, k, y: MC.top + (1 - l.prob / top) * plotH - MC.pillH / 2 }))
    .sort((a, b) => a.y - b.y);
  for (let j = 1; j < pills.length; j++) pills[j].y = Math.max(pills[j].y, pills[j - 1].y + MC.pillH + MC.gap);
  const overflow = (pills.at(-1)?.y ?? 0) + MC.pillH - (MC.height - MC.axis);
  if (overflow > 0) pills.forEach((p) => (p.y -= overflow));

  return (
    <div className="relative w-full" style={{ height: MC.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: MC.top, right: pillW + 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={[t0, t1]}
            ticks={ticks}
            tick={monoTick}
            tickFormatter={tickFmt}
            stroke={C.grid}
            tickLine={false}
            height={MC.axis}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis tick={monoTick} tickFormatter={(v) => pct(v)} axisLine={false} tickLine={false} width={40} domain={[0, top]} ticks={yTicks} />
          <Tooltip
            cursor={{ stroke: C.text3, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Record<string, number> | undefined;
              if (!active || !row) return null;
              return (
                <TooltipBox>
                  <div className="mb-1 text-text-3">{dateTime(row.ts)}</div>
                  {lines.map((l, k) =>
                    row[`l${k}`] === undefined ? null : (
                      <div key={l.key} className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color(k) }} />
                        {l.label}: <span className="font-medium">{pct(row[`l${k}`], 1)}</span>
                      </div>
                    ),
                  )}
                </TooltipBox>
              );
            }}
          />
          {lines.map((l, k) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={`l${k}`}
              stroke={color(k)}
              strokeWidth={l.featured ? 2.25 : 1.5}
              strokeOpacity={l.featured ? 1 : 0.85}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {pills.map(({ l, k, y }) => (
        <div
          key={l.key}
          className={`absolute right-0 flex items-center gap-1.5 rounded-md border bg-surface px-2 font-mono text-[11px] tabular-nums ${l.featured ? "border-accent" : "border-border"}`}
          style={{ top: y, width: pillW, height: MC.pillH }}
          title={`${l.label}: ${pct(l.prob, 1)} chance`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(k) }} aria-hidden />
          <span className="min-w-0 truncate text-text-2">{l.label.replace(/^(Below|Above) /, "")}</span>
          <span className="ml-auto font-semibold text-text">{pct(l.prob)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Past-promo look-back: the chance the promo would kick in, over the record. A dot marks the
 * price the hedge would have been bought at; a dashed line marks when it started counting.
 */
export function LookbackChart({
  data,
  boughtAt,
  cutoff,
  cutoffLabel,
}: {
  data: { ts: number; yes: number }[];
  boughtAt: number;
  cutoff: number;
  cutoffLabel: string;
}) {
  const bought = data.find((p) => p.ts === boughtAt);
  const t0 = data[0]?.ts ?? 0;
  const t1 = data.at(-1)?.ts ?? 0;
  const { ticks, stepH } = timeTicks(t0, t1);
  const tickFmt = (ts: number) => {
    const d = new Date(ts);
    return stepH >= 24 || (d.getHours() === 0 && d.getMinutes() === 0)
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleTimeString("en-US", { hour: "numeric" });
  };
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="ts" type="number" scale="time" domain={[t0, t1]} ticks={ticks} tick={axisTick} tickFormatter={tickFmt} stroke={C.grid} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={axisTick} tickFormatter={(v) => pct(v)} stroke={C.grid} width={44} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} />
          {cutoff >= t0 && cutoff <= t1 && (
            <ReferenceLine
              x={cutoff}
              stroke={C.text3}
              strokeDasharray="3 4"
              label={{ value: cutoffLabel, position: "insideTopRight", fill: "var(--text-2)", fontSize: 11 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: C.text3, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { ts: number; yes: number } | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox>
                  <div className="text-text-3">{dateTime(p.ts)}</div>
                  <div className="font-medium">{pct(p.yes, 1)} chance</div>
                </TooltipBox>
              );
            }}
          />
          <Line type="monotone" dataKey="yes" stroke={C.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
          {bought && <ReferenceDot x={bought.ts} y={bought.yes} r={6} fill={C.accent} stroke="var(--surface)" strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
