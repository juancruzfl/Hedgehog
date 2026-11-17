"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const links = [
  { href: "/crypto", label: "Crypto" },
  { href: "/business", label: "Business" },
  { href: "/positions", label: "My hedges" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <nav className="mx-auto flex max-w-6xl items-center gap-0.5 px-4 py-3 text-sm sm:gap-1">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold tracking-tight sm:mr-4" aria-label="hedgehog home">
          <Logo className="h-8 w-8 text-accent" />
          <span className="hidden text-base sm:inline">hedgehog</span>
        </Link>
        {/* Everything else sits on the right */}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path.startsWith(l.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-1.5 py-1.5 min-[400px]:px-2 sm:px-3 ${path.startsWith(l.href) ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:text-text"}`}
            >
              {l.label}
            </Link>
          ))}
          {/* On the crypto page, the one action that matters: change what you hold */}
          {path.startsWith("/crypto") && (
            <button
              onClick={() => window.dispatchEvent(new Event("hedgehog:edit-assets"))}
              aria-label="Edit assets"
              className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent px-2.5 py-1.5 font-semibold text-accent-ink hover:brightness-110 sm:ml-2 sm:px-3.5"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                <path d="m13.5 8.5 3 3" />
              </svg>
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit assets</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
