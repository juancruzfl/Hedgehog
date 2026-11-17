/** $1,234 / $65 / $217.80: cents only when they matter, unless `digits` is given. */
export const usd = (n: number, digits?: number) => {
  const d = digits ?? (Math.abs(n) >= 1000 || Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d, minimumFractionDigits: d });
};

export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;

export const qty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const dateTime = (iso: string | number) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "in 3 days", "in 14 hours" */
export function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.round(ms / 3600_000);
  if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
  return `in ${Math.round(h / 24)} days`;
}
