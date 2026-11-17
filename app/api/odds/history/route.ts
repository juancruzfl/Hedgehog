import type { NextRequest } from "next/server";
import { yesMid } from "@/lib/forecast/forecast";
import { historyForSymbol } from "@/lib/odds/store";

const WEEK = 7 * 24 * 3600_000;

/**
 * GET ?symbols=A,B -> { history: { [symbol]: { ts, yes }[] } }
 * The YES odds (mid price) recorded for each contract over the past week.
 */
export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const since = Date.now() - WEEK;
  const history: Record<string, { ts: number; yes: number }[]> = {};
  for (const sym of symbols) {
    try {
      history[sym] = historyForSymbol(sym, since).flatMap((p) => {
        const yes = yesMid(p);
        return yes === null ? [] : [{ ts: p.ts, yes }];
      });
    } catch {
      history[sym] = [];
    }
  }
  return Response.json({ history });
}
