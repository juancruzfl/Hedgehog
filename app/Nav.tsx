"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GeminiAccountButton } from "@/components/GeminiAccountButton";
import { Logo } from "@/components/Logo";
import { useAccount } from "@/components/useAccount";
import { ROLE_INFO } from "@/lib/auth/roles";

// Signed out: just the wordmark and "Connect Gemini account". Signed in: the parts of the
// app for what they hedge (Crypto, Business or both, picked on /welcome) plus My hedges, and
// the logo goes to the product's home (trending markets).
export function Nav() {
  const path = usePathname();
  const account = useAccount();
  const roles = account?.connected ? (account.roles ?? []) : [];
  const ready = account?.connected && roles.length > 0;
  const links = ready ? [...roles.map((r) => ({ href: ROLE_INFO[r].href, label: ROLE_INFO[r].nav })), { href: "/positions", label: "My hedges" }] : [];

  return (
    <header className={`border-b border-border bg-background ${path === "/" ? "" : "sticky top-0 z-20"}`}>
      <nav className="mx-auto flex max-w-6xl items-center gap-0.5 px-4 py-3 text-sm sm:gap-1">
        {/* Wordmark with the hedgehog to its right (the wordmark is hidden on phones) */}
        <Link href={ready ? "/markets" : "/"} className="-my-1 mr-2 flex items-center gap-2 sm:mr-4" aria-label={ready ? "hedgehog: trending markets" : "hedgehog home"}>
          <span className="hidden text-base font-bold tracking-tight sm:inline">hedgehog</span>
          <Logo className="h-10 w-10 text-text" />
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
          {/* Signed in but hasn't said what they hedge yet (e.g. left the picker): a way back to it */}
          {account?.connected && !ready && path !== "/welcome" && (
            <Link href="/welcome" className="whitespace-nowrap rounded-lg px-2 py-1.5 font-medium text-accent hover:underline sm:px-3">
              Finish setup
            </Link>
          )}
          {/* Signed-in state of the user's own Gemini account: where their orders go */}
          <GeminiAccountButton />
        </div>
      </nav>
    </header>
  );
}
