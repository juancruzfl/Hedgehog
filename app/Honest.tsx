// "Honest by design": a full-width band with a big centered title and a 2×3 grid of plain
// promises, each with a thin line icon (after Sensible Weather's "It really is that easy").

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ITEMS: { text: string; color: string; icon: React.ReactNode }[] = [
  {
    text: "Finds the closest live market and tells you how close it really is",
    color: "var(--accent)",
    // Crosshair on a target
    icon: (
      <>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
      </>
    ),
  },
  {
    text: "Shows what you pay, what you get back and what isn't covered",
    color: "var(--series-1)",
    // Receipt
    icon: (
      <>
        <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21Z" />
        <path d="M9 8h6M9 11.5h6M9 15h3.5" />
      </>
    ),
  },
  {
    text: "Says so plainly when no market fits your risk",
    color: "var(--series-2)",
    // Speech bubble with an exclamation
    icon: (
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5Z" />
        <path d="M12 7.5v4M12 13.8v.2" />
      </>
    ),
  },
  {
    text: "Never moves your crypto or asks for a seed phrase",
    color: "var(--bad)",
    // Key with a strike-through
    icon: (
      <>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12H20l-1.5 2M16.5 12v2" />
        <path d="M3.5 3.5l17 17" />
      </>
    ),
  },
  {
    text: "Never places an order without your approval",
    color: "var(--good)",
    // Hand raised with a check
    icon: (
      <>
        <path d="M8 13V6.5a1.25 1.25 0 0 1 2.5 0V11m0-5.5V4.75a1.25 1.25 0 0 1 2.5 0V11m0-5.25a1.25 1.25 0 0 1 2.5 0V12m0-3.5a1.25 1.25 0 0 1 2.5 0V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4-2L4.6 15.4a1.3 1.3 0 0 1 2-1.7L8 15" />
      </>
    ),
  },
  {
    text: "Every price is recorded and sealed on Solana, so you can check it",
    color: "#9945FF",
    // Seal badge with a check
    icon: (
      <>
        <path d="M12 2.5l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.5l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.9-2.7-.9-2.7L6 6.7l.9-2.7 2.8.2Z" />
        <path d="M8.8 12.2l2.2 2.2 4.2-4.6" />
      </>
    ),
  },
];

export function Honest() {
  return (
    <section className="flex flex-col justify-center bg-surface-2 py-20 md:min-h-svh" aria-labelledby="honest-title">
      <div className="mx-auto w-full max-w-5xl px-4">
        <h2 id="honest-title" className="text-center text-3xl font-medium tracking-[-0.02em] sm:text-[44px] sm:leading-tight">
          Honest by design
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-text-2">
          A hedge softens a loss. It doesn&apos;t erase it, and it costs money up front. Hedgehog shows you all of that before you decide.
        </p>
        <ul className="mt-12 grid gap-4 md:grid-cols-2">
          {ITEMS.map((it) => (
            <li key={it.text} className="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-5 text-[17px]">
              <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" style={{ color: it.color }} aria-hidden {...P}>
                {it.icon}
              </svg>
              {it.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
