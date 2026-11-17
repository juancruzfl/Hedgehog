"use client";

import { AgentSteps, type StepState } from "./AgentSteps";

/** What Gemini lists today, in plain words, so the user knows what *can* be hedged. */
const AVAILABLE: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: "Game results",
    body: "NFL, college and other games: who wins, by how much, total points",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16M4 12h16" />
      </>
    ),
  },
  {
    title: "Daily temperatures",
    body: "The high in about 50 US cities, day by day",
    icon: <path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z" />,
  },
  {
    title: "Fuel and energy",
    body: "Oil (WTI and Brent) and natural gas prices",
    icon: <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z" />,
  },
  {
    title: "Metals",
    body: "Gold, silver, copper and other metal prices",
    icon: (
      <>
        <path d="M4 18h16l-3-7H7l-3 7Z" />
        <path d="M8 11l2-5h4l2 5" />
      </>
    ),
  },
  {
    title: "Crypto prices",
    body: "Bitcoin, Ether, Solana and XRP",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M10 8h3a2 2 0 0 1 0 4h-3m0 0h3.5a2 2 0 0 1 0 4H10V8Z" />
      </>
    ),
  },
];

/**
 * Shown when no live Gemini market lines up with the risk. Says so plainly, shows what
 * *can* be hedged today, and gives two clear next moves: reword it, or try an example.
 */
export function NoMatch({
  headline,
  reason,
  examples,
  onEdit,
  onExample,
  steps,
  followUps,
}: {
  headline: string;
  reason: string;
  examples: { label: string; text: string }[];
  onEdit: () => void;
  onExample: (text: string) => void;
  steps: StepState[];
  followUps: string[];
}) {
  return (
    <div className="flex min-h-[calc(90dvh-4rem)] flex-col items-center justify-center py-10">
      <p className="text-sm font-semibold text-accent">Your risk</p>
      <h1 className="mt-1 max-w-3xl text-center text-3xl font-bold tracking-tight sm:text-4xl">{headline}</h1>

      <section className="mt-8 w-full max-w-3xl rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-text-2" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4.5-4.5M9 9l4 4M13 9l-4 4" />
            </svg>
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">No Gemini market fits this yet</h2>
            <p className="mt-1 text-text-2">{reason} Nothing to approve, and nothing was placed.</p>
          </div>
        </div>

        <p className="mt-6 text-sm font-semibold">What you can hedge on Gemini today</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {AVAILABLE.map((a) => (
            <li key={a.title} className="flex gap-3 rounded-2xl bg-surface-2 px-4 py-3 sm:[&:last-child:nth-child(odd)]:col-span-2">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {a.icon}
              </svg>
              <div>
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-sm text-text-2">{a.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {followUps.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold">These details could help find a match</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text-2">
              {followUps.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button onClick={onEdit} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
            Describe it differently
          </button>
          <span className="text-sm text-text-3">Tip: tie it to one of the things above, like a game, the weather or fuel prices.</span>
        </div>
      </section>

      <div className="mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-text-3">Or try an example:</span>
        {examples.map((ex) => (
          <button
            key={ex.label}
            onClick={() => onExample(ex.text)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-2 hover:border-accent hover:text-accent"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <details className="mt-6 w-full max-w-3xl rounded-2xl border border-border bg-surface px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold">How Hedgehog searched</summary>
        <div className="mt-4">
          <AgentSteps steps={steps} />
        </div>
      </details>
    </div>
  );
}
