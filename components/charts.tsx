"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm" style={{ color: "var(--text)" }}>
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
          <YAxis hide domain={[0, "dataMax"]} />
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

/** How the market's odds moved over time, one line per price level (max 3, fixed color order). */
export function OddsHistoryChart({ series, title }: { series: OddsSeries[]; title: string }) {
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
  const data = [...rows.values()].sort((a, b) => a.ts - b.ts);
  const last = data.length - 1;
  // Clean y ticks: pick a step that gives at most ~5 ticks.
  const maxVal = Math.max(0.01, ...data.flatMap((r) => shown.map((_, i) => r[`s${i}`] ?? 0)));
  const step = [0.02, 0.05, 0.1, 0.2, 0.25].find((st) => Math.ceil((maxVal + 0.01) / st) <= 5) ?? 0.25;
  const top = Math.min(1, Math.ceil((maxVal + 0.01) / step) * step);
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  const spanHours = data.length > 1 ? (data[last].ts - data[0].ts) / 3600_000 : 0;
  const tickFmt = (ts: number) =>
    new Date(ts).toLocaleString("en-US", spanHours > 36 ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" });

  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-text-2">
        {shown.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: SERIES[i] }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 56, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={axisTick} tickFormatter={tickFmt} stroke={C.grid} minTickGap={40} />
            <YAxis tick={axisTick} tickFormatter={(v) => pct(v)} stroke={C.grid} width={44} domain={[0, top]} ticks={yTicks} />
            <Tooltip
              cursor={{ stroke: C.text3, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Record<string, number> | undefined;
                if (!active || !row) return null;
                return (
                  <TooltipBox>
                    <div className="mb-1 text-text-3">{dateTime(row.ts)}</div>
                    {shown.map((s, i) =>
                      row[`s${i}`] === undefined ? null : (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[i] }} />
                          {s.label}: <span className="font-medium">{pct(row[`s${i}`], 1)}</span>
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
                connectNulls
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
        Market-implied chance from Gemini prediction markets, recorded every 5 minutes by Hedgehog.
      </p>
    </figure>
  );
}
