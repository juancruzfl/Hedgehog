"use client";

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
            {i < steps.length - 1 && <span aria-hidden className={`absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px ${s.status === "done" ? "bg-good" : "bg-border"}`} />}
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
