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
export function PayoffChart({ data, spot, asset }: { data: CurvePoint[]; spot: number; asset: string }) {
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
              tickFormatter={(v) => usd(v, v >= 1000 ? 0 : 0)}
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
      <figcaption className="mt-1 text-xs text-text-3">
        Your gain or loss on this holding at expiry, including what the hedge costs. Hover to compare any price.
      </figcaption>
    </figure>
  );
}
