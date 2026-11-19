// Past-promo look-back: "if you'd hedged your promo, here's what would have happened".
// Pure functions only (no I/O): the odds come from Hedgehog's own archive and the result
// from Gemini's settlement, both passed in. Same contract math as the live sizer:
// every contract pays $1 if it resolves YES.

export type LookbackCategory = "Sports" | "Weather";

/** When the business would have bought the hedge. */
export type HedgeWhen = "early" | "day" | "last";

export const HEDGE_WHEN: { value: HedgeWhen; label: string; sub: string }[] = [
  { value: "early", label: "As early as possible", sub: "first price on record" },
  { value: "day", label: "The day before", sub: "24 hours ahead" },
  { value: "last", label: "Last minute", sub: "right before it counted" },
];

export const isHedgeWhen = (v: unknown): v is HedgeWhen => v === "early" || v === "day" || v === "last";

const HOUR = 3600_000;

/** Gemini tickers carry a UTC time (yymmddhhmm): NFL-2611200115-IND-HOU-M, WXHIGH-AUS-2611180459. */
export function tickerTime(id: string): number | null {
  const m = /-(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?=-|$)/.exec(id);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const t = Date.UTC(2000 + y, mo - 1, d, h, mi);
  return Number.isFinite(t) ? t : null;
}

/**
 * The last moment a hedge could fairly have been bought, so the look-back never uses a
 * price from after the outcome started to show. Games: kickoff (the ticker time).
 * Weather: the ticker time is the end of the measured day (about midnight ET), so the
 * cutoff is 10 AM ET that day, well before the afternoon high.
 */
export function hedgeCutoff(id: string, category: LookbackCategory): number | null {
  const t = tickerTime(id);
  if (t === null) return null;
  return category === "Weather" ? t - 24 * HOUR + 10 * HOUR : t;
}

export interface ArchivedPoint {
  ts: number;
  yesBid: number | null;
  yesAsk: number | null;
  last: number | null;
}

/** The reading the hedge would have been bought at: the YES ask at that time. */
export function pickReading(points: ArchivedPoint[], cutoff: number, when: HedgeWhen): (ArchivedPoint & { yesAsk: number }) | null {
  const usable = points.filter((p): p is ArchivedPoint & { yesAsk: number } => p.ts <= cutoff && p.yesAsk !== null && p.yesAsk > 0 && p.yesAsk < 1);
  if (!usable.length) return null;
  if (when === "early") return usable[0];
  if (when === "last") return usable.at(-1)!;
  // A day before: the latest reading at or before cutoff − 24h; if the record starts later, the earliest one.
  const target = cutoff - 24 * HOUR;
  return usable.filter((p) => p.ts <= target).at(-1) ?? usable[0];
}

const money = (n: number) => Math.round(n * 100) / 100;

export interface LookbackMath {
  contracts: number; // bought, each pays $1 if the promo was triggered
  price: number; // per contract, the archived ask
  hedgeCost: number;
  payout: number | null; // null until the market settles
  /** The business's result for this promo, without and with the hedge (negative = money out). */
  without: number | null;
  withHedge: number | null;
  /** withHedge − without: positive = the hedge saved money, negative = it cost money. */
  saved: number | null;
  /** Worst case with the hedge, known on the day it was bought. */
  worstWithHedge: number;
}

/**
 * Size the hedge to pay back the full promo cost (rounded down to the contract grid, so
 * it never over-buys), then score it against what actually happened.
 */
export function lookbackMath(input: {
  promoCost: number;
  price: number;
  triggered: boolean | null;
  quantityIncrement?: number;
}): LookbackMath {
  const inc = input.quantityIncrement && input.quantityIncrement > 0 ? input.quantityIncrement : 1;
  const contracts = Number((Math.floor(input.promoCost / inc + 1e-9) * inc).toFixed(8));
  const hedgeCost = money(contracts * input.price);
  const uncovered = money(input.promoCost - contracts);
  const worstWithHedge = money(-hedgeCost - uncovered);
  if (input.triggered === null) {
    return { contracts, price: input.price, hedgeCost, payout: null, without: null, withHedge: null, saved: null, worstWithHedge };
  }
  const payout = input.triggered ? contracts : 0;
  const without = input.triggered ? -input.promoCost : 0;
  const withHedge = money(without + payout - hedgeCost);
  return { contracts, price: input.price, hedgeCost, payout, without: money(without), withHedge, saved: money(withHedge - without), worstWithHedge };
}

/** "Indianapolis won" / "the high was 70°F or above", for "Half-price wings if …". */
export function triggerPhrase(category: LookbackCategory, label: string, tense: "past" | "future" | "not" = "past"): string {
  if (category === "Weather") return `the high ${tense === "past" ? "was" : tense === "not" ? "wasn't" : "is"} ${label}`;
  if (/^(draw|tie)$/i.test(label.trim()))
    return tense === "past" ? "the game ended in a draw" : tense === "not" ? "the game didn't end in a draw" : "the game ends in a draw";
  return `${label} ${tense === "past" ? "won" : tense === "not" ? "didn't win" : "wins"}`;
}

/** "Nov 18, 8:15 PM ET": fixed to Eastern so the server and the browser print the same thing. */
export const etTime = (ms: number) =>
  `${new Date(ms).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`;

export const etDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

/** "Highest temperature in Austin on November 17, 2026?" → "Austin high temperature". Games keep their title. */
export function eventName(category: LookbackCategory, title: string): string {
  const t = title.replace(/\?$/, "");
  if (category === "Weather") {
    const m = /^Highest temperature in (.+?) on /i.exec(t);
    return m ? `${m[1]} high temperature` : t;
  }
  return t;
}

/** League badge from the ticker: NFL, NBA, NCAAM… */
export const leagueOf = (id: string) => id.split("-")[0];
