"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GeminiAccountButton } from "@/components/GeminiAccountButton";
import { Logo } from "@/components/Logo";

const links = [
  { href: "/crypto", label: "Crypto" },
  { href: "/business", label: "Business" },
  { href: "/positions", label: "My hedges" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className={`border-b border-border bg-background ${path === "/" ? "" : "sticky top-0 z-20"}`}>
      <nav className="mx-auto flex max-w-6xl items-center gap-0.5 px-4 py-3 text-sm sm:gap-1">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold tracking-tight sm:mr-4" aria-label="hedgehog home">
          <span className="hidden text-base sm:inline">hedgehog</span>
          <Logo className="h-8 w-8 text-text" />
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
          {/* Signed-in state of the user's own Gemini account: where their orders go */}
          <GeminiAccountButton />
        </div>
      </nav>
    </header>
  );
}
