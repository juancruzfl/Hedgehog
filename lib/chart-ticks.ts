// Even time-axis ticks for odds charts: round local hours, or local midnights for long spans.

const HOUR = 3600_000;
const TICK_STEPS_H = [1, 2, 3, 4, 6, 12, 24, 48, 72, 168];

/** Evenly spaced time ticks on round local hours (or local midnights), at most `max` of them. */
export function timeTicks(min: number, max: number, maxTicks = 6): { ticks: number[]; stepH: number } {
  const span = max - min;
  const stepH = TICK_STEPS_H.find((h) => span / (h * HOUR) <= maxTicks - 1) ?? 168;
  const d = new Date(min);
  d.setMinutes(0, 0, 0);
  if (stepH >= 24) d.setHours(0);
  // Walk to the first round tick at or after `min` (local hour divisible by the step).
  while (d.getTime() < min || (stepH < 24 && d.getHours() % stepH !== 0)) d.setHours(d.getHours() + (stepH >= 24 ? 24 : 1));
  const ticks: number[] = [];
  for (; d.getTime() <= max; d.setHours(d.getHours() + stepH)) ticks.push(d.getTime());
  return { ticks, stepH };
}
