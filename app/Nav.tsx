"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[13px] font-black text-accent-ink">h</span>
          <span className="hidden text-base sm:inline">hedgehog</span>
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 ${path.startsWith(l.href) ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:text-text"}`}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/crypto" className="ml-auto hidden whitespace-nowrap rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-accent-ink hover:brightness-110 sm:inline-block">
          Check my risk
        </Link>
      </nav>
    </header>
  );
}
