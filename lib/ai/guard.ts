// Guardrails for the business AI: keep it to finding markets for real risks, and cap spend.
//
// 1. screenInput: free checks that reject obvious non-risks (math, gibberish) before any AI call.
//    Deliberately narrow: anything that might be a real risk goes through to the AI.
// 2. The AI's first call also decides whether the text describes a risk at all
//    (see `isRisk` in parseRisk), so off-topic text never reaches the later, larger calls.
// 3. Limits: requests per visitor per hour, and AI analyses per day across everyone.
//    Past the daily cap, Hedgehog's free basic matcher takes over instead of the AI.

export const OFF_TOPIC_MESSAGE =
  "Hedgehog only finds markets that offset a money risk. Describe something that could cost your business money, like a promo tied to a game, fuel or metal prices, or weather that hurts sales.";

const MATH_ONLY = /^[\d\s.,+\-*/x×÷^%()=?]+$/i;
const QUESTION_LEAD = /^(what\s*(is|'s|s)|whats|calculate|compute|solve|how much is)\s+/i;

/** Free pre-check. Returns a reason to reject, or null to let the text through. */
export function screenInput(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  const bare = t.replace(QUESTION_LEAD, "").replace(/[?!.]+$/, "").trim();
  if (bare && MATH_ONLY.test(bare)) return OFF_TOPIC_MESSAGE;
  const words = t.match(/[a-z]{2,}/gi) ?? [];
  if (words.length < 2) return OFF_TOPIC_MESSAGE;
  return null;
}

// ---------- limits ----------

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const limits = () => ({
  perVisitorPerHour: num(process.env.AI_LIMIT_PER_HOUR, 20),
  perDay: num(process.env.AI_DAILY_LIMIT, 300), // ~$1/day at ~$0.003 per analysis
});

const HOUR = 3600_000;
const visits = new Map<string, number[]>();
let day = { key: "", count: 0 };

/** Counts a request from this visitor. Returns minutes to wait if they're over the hourly limit. */
export function takeVisit(visitor: string, now = Date.now()): { ok: true } | { ok: false; retryMin: number } {
  const recent = (visits.get(visitor) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= limits().perVisitorPerHour) {
    visits.set(visitor, recent);
    return { ok: false, retryMin: Math.max(1, Math.ceil((recent[0] + HOUR - now) / 60_000)) };
  }
  recent.push(now);
  visits.set(visitor, recent);
  if (visits.size > 10_000) for (const [k, v] of visits) if (!v.some((t) => now - t < HOUR)) visits.delete(k);
  return { ok: true };
}

/** Uses one AI analysis from today's budget (UTC day). False once the day's budget is spent. */
export function takeDailyAI(now = Date.now()): boolean {
  const key = new Date(now).toISOString().slice(0, 10);
  if (day.key !== key) day = { key, count: 0 };
  if (day.count >= limits().perDay) return false;
  day.count++;
  return true;
}

export function resetLimitsForTests() {
  visits.clear();
  day = { key: "", count: 0 };
}

/** Best-effort visitor id from the proxy headers (Railway sets X-Forwarded-For). */
export function visitorId(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

// ---------- cache ----------

/** Short-lived cache so repeated clicks on the same example don't pay for the same AI answer twice. */
export class TtlCache<V> {
  private m = new Map<string, { v: Promise<V>; at: number }>();
  constructor(
    private ttlMs = 15 * 60_000,
    private max = 200,
  ) {}
  get(key: string, make: () => Promise<V>, now = Date.now()): Promise<V> {
    const hit = this.m.get(key);
    if (hit && now - hit.at < this.ttlMs) return hit.v;
    const v = make();
    v.catch(() => this.m.delete(key)); // never cache failures
    this.m.set(key, { v, at: now });
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value!);
    return v;
  }
}
