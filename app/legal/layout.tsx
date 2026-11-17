import Link from "next/link";
import { LEGAL_PAGES } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-[13rem_1fr]">
        <nav aria-label="Legal documents" className="md:sticky md:top-20 md:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-3">Legal</p>
          <ul className="mt-2 flex flex-wrap gap-2 md:flex-col md:gap-1">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="block rounded-lg px-2 py-1.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="legal min-w-0">{children}</article>
      </div>
    </main>
  );
}
