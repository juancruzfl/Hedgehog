import { LEGAL } from "@/lib/legal";

/** Title, effective date and a plain-English summary box for each legal document. */
export function DocHeader({ title, summary }: { title: string; summary: React.ReactNode }) {
  const missing = !LEGAL.operator || !LEGAL.contactEmail || !LEGAL.governingState;
  return (
    <header>
      <h1>{title}</h1>
      <p className="!mt-2 text-sm">Effective {LEGAL.effective}</p>
      {missing && (
        <p className="rounded-xl bg-warn-bg px-4 py-3 text-sm !text-text">
          Draft: some details (operator name, contact email, governing law) are still to be added before public launch.
        </p>
      )}
      <div className="mt-4 rounded-xl border border-border bg-surface px-5 py-4">
        <p className="!mt-0 text-sm font-semibold !text-text">In short</p>
        <div className="text-sm">{summary}</div>
      </div>
    </header>
  );
}
