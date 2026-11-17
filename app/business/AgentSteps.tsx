"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StepId } from "@/lib/business/analyze";

export type StepStatus = "idle" | "active" | "done" | "error";
export interface StepState {
  id: StepId;
  status: StepStatus;
  detail?: string;
}

export const STEP_LABELS: Record<StepId, { title: string; idle: string }> = {
  understand: { title: "Understanding your risk", idle: "What happens, when, and what it would cost you" },
  search: { title: "Searching Gemini markets", idle: "Finding live markets on the same event or price" },
  match: { title: "Checking the fine print", idle: "How closely each market matches your risk" },
  price: { title: "Pricing each option", idle: "What you'd pay now and get back" },
};

export const initialSteps = (): StepState[] => (["understand", "search", "match", "price"] as StepId[]).map((id) => ({ id, status: "idle" }));

function Marker({ status }: { status: StepStatus }) {
  if (status === "done")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-good-soft text-xs font-bold text-good" aria-label="Done">
        ✓
      </span>
    );
  if (status === "error")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bad-soft text-xs font-bold text-bad" aria-label="Stopped">
        !
      </span>
    );
  if (status === "active")
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center" aria-label="Working">
        <span className="absolute inset-0 rounded-full border-2 border-accent-soft" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent motion-safe:animate-spin" />
      </span>
    );
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border" aria-label="Not started" />;
}

/** The engine's working steps, updated live from the analysis stream. */
export function AgentSteps({ steps }: { steps: StepState[] }) {
  return (
    <ol className="space-y-0" aria-live="polite">
      {steps.map((s, i) => {
        const label = STEP_LABELS[s.id];
        return (
          <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className={`absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px ${s.status === "done" ? "bg-good" : "bg-border"}`} />
            )}
            <Marker status={s.status} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${s.status === "idle" ? "text-text-3" : "text-text"}`}>{label.title}</p>
              <p className={`text-sm ${s.status === "error" ? "text-bad" : s.status === "idle" ? "text-text-3" : "text-text-2"}`}>{s.detail ?? label.idle}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The steps while the engine works, as the page's focal point: the step running now is
 * shown large, finished ones shrink to a checked line above it, upcoming ones wait below.
 */
export function FocusSteps({ steps }: { steps: StepState[] }) {
  const current = steps.findIndex((s) => s.status === "active" || s.status === "error");
  const focus = current >= 0 ? current : steps.findIndex((s) => s.status === "idle");
  const allDone = focus < 0;
  return (
    <ol className="space-y-3" aria-live="polite">
      {steps.map((s, i) => {
        const label = STEP_LABELS[s.id];
        if (i === focus) {
          return (
            <li key={s.id} className="hh-swap-in rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-4">
                <span className="scale-150">
                  <Marker status={s.status === "idle" ? "active" : s.status} />
                </span>
                <p className="ml-1 text-2xl font-bold tracking-tight sm:text-3xl">{label.title}</p>
              </div>
              <p className={`mt-3 text-lg ${s.status === "error" ? "text-bad" : "text-text-2"}`}>{s.detail ?? label.idle}</p>
            </li>
          );
        }
        const done = s.status === "done" || s.status === "error";
        return (
          <li key={s.id} className={`flex items-start gap-3 px-2 ${done ? "" : "opacity-50"}`}>
            <Marker status={s.status} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${done ? "text-text" : "text-text-3"}`}>{label.title}</p>
              {done && s.detail && <p className="text-sm text-text-2">{s.detail}</p>}
            </div>
          </li>
        );
      })}
      {allDone && (
        <li className="hh-swap-in rounded-3xl border border-good bg-surface p-6 text-center shadow-sm">
          <p className="text-2xl font-bold tracking-tight">Found your best options</p>
          <p className="mt-1 text-text-2">Bringing them up now…</p>
        </li>
      )}
    </ol>
  );
}

const HOW: { id: StepId; icon: React.ReactNode; body: string }[] = [
  {
    id: "understand",
    body: "Hedgehog reads what you wrote: what would happen, when, and roughly what it would cost you.",
    icon: <path d="M4 5h16v10H8l-4 4V5Z" />,
  },
  {
    id: "search",
    body: "It searches live Gemini prediction markets for one tied to the same event or price.",
    icon: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
      </>
    ),
  },
  {
    id: "match",
    body: "It reads each market's rules and tells you plainly how closely it matches your risk.",
    icon: (
      <>
        <path d="M7 4h7l4 4v12H7V4Z" />
        <path d="M10 13l2 2 3-4" />
      </>
    ),
  },
  {
    id: "price",
    body: "It prices each option: what you pay now and what you'd get back if it happens.",
    icon: (
      <>
        <path d="M12 3v18" />
        <path d="M16 7.5c0-1.7-1.8-2.5-4-2.5s-4 1-4 2.8c0 3.7 8 2 8 6 0 1.8-1.8 3.2-4 3.2s-4-.9-4-2.7" />
      </>
    ),
  },
];

/**
 * "How Hedgehog works" behind an ⓘ next to the title: opens on hover or keyboard focus,
 * and on tap for touch screens. Esc or tapping elsewhere closes it.
 */
export function HowItWorksTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // Where the panel goes: under the icon, kept 16px inside the screen edges.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const place = () => {
      const b = ref.current!.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(416, vw - 32);
      const left = Math.min(Math.max(b.left + b.width / 2 - width / 2, 16), vw - 16 - width);
      setPos({ top: b.bottom, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle" // Hover only for a real mouse; a tap is handled by onClick below.
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-label="How Hedgehog works"
        aria-expanded={open}
        aria-controls="how-it-works"
        onClick={() => setOpen((o) => !o)}
        // Keyboard focus opens it; focus from a tap doesn't (the tap toggles it instead).
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setOpen(false)}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border text-base font-bold italic text-text-3 hover:border-accent hover:text-accent aria-expanded:border-accent aria-expanded:text-accent"
      >
        i
      </button>
      {open && (
        <div
          id="how-it-works"
          role="dialog"
          aria-label="How Hedgehog works"
          className="hh-swap-in fixed z-30 pt-3 text-left text-base font-normal tracking-normal"
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden" }}
        >
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg shadow-black/10">
            <p className="font-semibold">How Hedgehog works</p>
            <ol className="mt-3 space-y-3">
              {HOW.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {h.icon}
                  </svg>
                  <div>
                    <p className="text-sm font-semibold">{STEP_LABELS[h.id].title}</p>
                    <p className="text-sm text-text-2">{h.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-3 text-xs text-text-3">
              You&apos;ll see each step live once you send. Nothing is placed without your approval.
            </p>
          </div>
        </div>
      )}
    </span>
  );
}
