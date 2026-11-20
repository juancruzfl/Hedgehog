"use client";

import { useEffect, useRef, useState } from "react";

// "How it works" as a looping walk-through: once the steps scroll into view, each one is
// focused in turn (it pops forward, the rest dim), all three show as done for a beat, then
// it starts over. Reduced-motion users see every step finished, without motion.

export interface Step {
  title: string;
  body: string;
  example: string;
}

const STEP_MS = 2200;

export function HowItWorks({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLOListElement>(null);
  // -1 = not started; k = step k is in focus; steps.length = all done.
  const [active, setActive] = useState(-1);
  const done = active >= steps.length;

  // Start when the steps are mostly on screen (once).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(steps.length);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive((a) => (a < 0 ? 0 : a));
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [steps.length]);

  // Advance one step at a time; after the "all done" beat, start over.
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (active < 0 || reduced) return;
    const t = setTimeout(() => setActive((a) => (a >= steps.length ? 0 : a + 1)), done ? STEP_MS * 1.2 : STEP_MS);
    return () => clearTimeout(t);
  }, [active, done, reduced, steps.length]);

  // The line between the numbers fills up to the step in focus.
  const fill = active < 0 ? 0 : Math.min(active, steps.length - 1) / (steps.length - 1);

  return (
    <div>
      {/* Phones: a left-aligned timeline (number, then text). Desktop: three columns joined by a line. */}
      <ol ref={ref} className="relative mt-8 grid gap-5 md:mt-10 md:grid-cols-3 md:gap-6" aria-live="polite">
        <span className="absolute bottom-6 left-5 top-5 w-0.5 -translate-x-1/2 rounded-full bg-border md:hidden" aria-hidden>
          <span className="block w-full rounded-full bg-accent transition-[height] duration-1000 ease-out" style={{ height: `${fill * 100}%` }} />
        </span>
        <span className="absolute left-[16.6%] right-[16.6%] top-5 hidden h-0.5 rounded-full bg-border md:block" aria-hidden>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-1000 ease-out" style={{ width: `${fill * 100}%` }} />
        </span>
        {steps.map((s, k) => {
          const state = done || k < active ? "done" : k === active ? "active" : "pending";
          return (
            <li
              key={s.title}
              aria-current={state === "active" ? "step" : undefined}
              className={`relative flex items-start gap-4 text-left transition duration-500 ease-out md:flex-col md:items-center md:gap-0 md:text-center ${
                state === "pending" ? "opacity-55 md:scale-[0.97] md:opacity-40" : state === "active" ? "z-10 opacity-100 md:scale-[1.04]" : "opacity-100"
              }`}
            >
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition duration-300 ${
                  state === "pending" ? "bg-surface-2 text-text-3" : "bg-accent text-accent-ink"
                }`}
              >
                {state === "active" && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" aria-hidden />}
                <span className="relative">{state === "done" ? "✓" : k + 1}</span>
              </span>
              <div className="min-w-0 flex-1 md:flex md:w-full md:flex-col md:items-center">
                <h3 className="pt-2 text-lg font-medium md:mt-4 md:pt-0">{s.title}</h3>
                <p className="mt-1 text-sm text-text-2 md:max-w-xs">{s.body}</p>
                <p
                  className={`mt-3 w-full rounded-xl border bg-surface px-4 py-3 text-sm font-medium tabular-nums transition duration-500 md:mt-4 ${
                    state === "active" ? "border-accent shadow-[0_12px_32px_-12px_rgba(14,116,144,0.45)]" : "border-border"
                  }`}
                >
                  {s.example}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
