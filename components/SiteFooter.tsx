import Link from "next/link";
import { LEGAL_PAGES } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="text-text-2 hover:text-text hover:underline">
              {p.title}
            </Link>
          ))}
          <Link href="/legal/privacy#notice-at-collection" className="text-text-2 hover:text-text hover:underline">
            Notice at Collection
          </Link>
          <Link href="/archive" className="text-text-2 hover:text-text hover:underline">
            Odds archive
          </Link>
        </nav>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-text-3">
          Hedgehog is software, not an exchange, broker, financial advisor or insurer, and nothing on this site is financial advice. Prediction
          market contracts are offered by Gemini under its own terms. A hedge reduces, but does not remove, losses, and you can lose what you pay
          for it. For adults 18+ in the United States. We don&apos;t sell or share personal information.
        </p>
        <p className="mt-2 text-xs text-text-3">© {new Date().getFullYear()} Hedgehog</p>
      </div>
    </footer>
  );
}
