// Small shared building blocks for the step-by-step flows.

export function StepHeading({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{n}</span>
      <div>
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-text-2">{sub}</p>}
      </div>
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3 sm:px-4">
      <p className="text-[11px] text-text-2 sm:text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {note && <p className="text-[11px] leading-snug text-text-3 sm:text-xs">{note}</p>}
    </div>
  );
}

/** "about 1 in 5" / "about a coin flip": odds people can picture. */
export function oddsInWords(p: number): string {
  if (p >= 0.45 && p <= 0.55) return "about a coin flip";
  if (p > 0.55) return p > 0.8 ? "very likely" : "more likely than not";
  if (p < 0.02) return "very unlikely";
  return `about 1 in ${Math.round(1 / p)}`;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3.5 py-2 text-left text-sm transition ${
            o.value === value ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2 hover:border-text-3"
          }`}
        >
          {o.label}
          {o.sub && <span className="block text-xs font-normal text-text-3">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}
