"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GEMINI_CHANGED_EVENT, refreshAccount, setAccount, useAccount } from "./useAccount";

// Nav button for the user's Gemini account: "Connect Gemini account" until they sign in
// with Gemini, then "Signed in" with a small menu (which account, what they hedge, sign out).

export { GEMINI_CHANGED_EVENT };

const NOTICES: Record<string, { kind: "good" | "bad"; text: string }> = {
  connected: { kind: "good", text: "Your Gemini account is connected." },
  cancelled: { kind: "bad", text: "Gemini sign-in was cancelled. Nothing was connected." },
  error: { kind: "bad", text: "Couldn't connect your Gemini account. Please try again." },
  "not-configured": { kind: "bad", text: "Gemini sign-in isn't set up on this server yet." },
  required: { kind: "bad", text: "Connect your Gemini account to continue." },
};

export function GeminiAccountButton() {
  const path = usePathname();
  const router = useRouter();
  const status = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<keyof typeof NOTICES | null>(null);
  // Sent here from a page that needs sign-in: connecting goes back to that page.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Coming back from Gemini: show how it went once, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("signin") === "required") {
      url.searchParams.set("gemini", "required");
      const next = url.searchParams.get("next");
      if (next?.startsWith("/") && !next.startsWith("//")) setReturnTo(next);
      url.searchParams.delete("signin");
      url.searchParams.delete("next");
    }
    const result = url.searchParams.get("gemini");
    if (!result) return;
    if (result in NOTICES) setNotice(result as keyof typeof NOTICES);
    url.searchParams.delete("gemini");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, []);

  // Close the menu on outside click or Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    await fetch("/api/auth/gemini/logout", { method: "POST" }).catch(() => undefined);
    setAccount({ connected: false, available: true, mode: status?.mode === "sandbox-key" ? "sandbox-key" : "oauth" });
    void refreshAccount(); // the server's view (e.g. which sign-in is available)
    router.push("/"); // the product's pages are for signed-in users
  }

  const n = notice && !menuOpen ? NOTICES[notice] : null;
  const noticeText = n && notice === "connected" && status?.mode === "sandbox-key" ? "Connected to Gemini's sandbox (test exchange)." : n?.text;

  return (
    <div ref={menuRef} className="relative ml-1 sm:ml-2">
      {!status ? (
        // Holds the space while the status loads, so the nav doesn't jump.
        <span className="block h-8 w-20 animate-pulse rounded-lg bg-surface-2 sm:w-48" aria-hidden />
      ) : status.connected ? (
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 font-medium text-text hover:border-text-3 sm:px-3"
        >
          <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
          Signed in
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-text-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <a
          href={`/api/auth/gemini/login?next=${encodeURIComponent(returnTo ?? path)}`}
          className="inline-flex items-center whitespace-nowrap rounded-lg bg-accent px-2.5 py-1.5 font-semibold text-accent-ink hover:brightness-110 sm:px-3.5"
        >
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">{status.mode === "sandbox-key" ? "Connect Gemini sandbox" : "Connect Gemini account"}</span>
        </a>
      )}

      {menuOpen && status?.connected && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-border bg-surface p-1.5 text-sm shadow-lg">
          <div className="px-3 py-2">
            <p className="text-xs text-text-3">{status.mode === "sandbox-key" ? "Connected to Gemini's sandbox" : "Connected to Gemini"}</p>
            <p className="mt-0.5 truncate font-semibold">{status.account ?? "Your Gemini account"}</p>
            {status.env === "sandbox" && <p className="mt-1 inline-block rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn">Test account (sandbox)</p>}
            {status.mode === "sandbox-key" && (
              <p className="mt-1.5 text-xs leading-snug text-text-2">
                A shared demo account on Gemini&apos;s test exchange, while Hedgehog&apos;s Gemini sign-in awaits approval. No real money.
              </p>
            )}
          </div>
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" href="/welcome" onClick={() => setMenuOpen(false)} className="block w-full rounded-lg px-3 py-2 text-left text-text hover:bg-surface-2">
            Change what you hedge
          </Link>
          <button role="menuitem" onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left text-text hover:bg-surface-2">
            Sign out
          </button>
        </div>
      )}

      {n && (
        <div
          role="status"
          className={`absolute right-0 top-full z-30 mt-2 flex w-72 items-start gap-2 rounded-xl border px-3.5 py-3 text-sm shadow-lg ${
            n.kind === "good" ? "border-good/30 bg-good-soft text-good" : "border-bad/30 bg-bad-soft text-bad"
          }`}
        >
          <span className="flex-1">{noticeText}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="-mr-1 rounded px-1 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
