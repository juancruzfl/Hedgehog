"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Nav button for the user's Gemini account: "Connect Gemini account" until they sign in
// with Gemini, then "Signed in" with a small menu (which account, sign out).

export const GEMINI_CHANGED_EVENT = "hedgehog:gemini-changed";

interface Status {
  connected: boolean;
  env?: "sandbox" | "production";
  account?: string | null;
}

const NOTICES: Record<string, { kind: "good" | "bad"; text: string }> = {
  connected: { kind: "good", text: "Your Gemini account is connected." },
  cancelled: { kind: "bad", text: "Gemini sign-in was cancelled. Nothing was connected." },
  error: { kind: "bad", text: "Couldn't connect your Gemini account. Please try again." },
  "not-configured": { kind: "bad", text: "Gemini sign-in isn't set up on this server yet." },
};

export function GeminiAccountButton() {
  const path = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<keyof typeof NOTICES | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    fetch("/api/auth/gemini/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(GEMINI_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GEMINI_CHANGED_EVENT, refresh);
  }, [refresh]);

  // Coming back from Gemini: show how it went once, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("gemini");
    if (!result) return;
    if (result in NOTICES) setNotice(result);
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
    setStatus({ connected: false });
    window.dispatchEvent(new Event(GEMINI_CHANGED_EVENT));
  }

  const n = notice ? NOTICES[notice] : null;

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
          href={`/api/auth/gemini/login?next=${encodeURIComponent(path)}`}
          className="inline-flex items-center whitespace-nowrap rounded-lg bg-accent px-2.5 py-1.5 font-semibold text-accent-ink hover:brightness-110 sm:px-3.5"
        >
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect Gemini account</span>
        </a>
      )}

      {menuOpen && status?.connected && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-border bg-surface p-1.5 text-sm shadow-lg">
          <div className="px-3 py-2">
            <p className="text-xs text-text-3">Connected to Gemini</p>
            <p className="mt-0.5 truncate font-semibold">{status.account ?? "Your Gemini account"}</p>
            {status.env === "sandbox" && <p className="mt-1 inline-block rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn">Test account (sandbox)</p>}
          </div>
          <div className="my-1 border-t border-border" />
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
          <span className="flex-1">{n.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="-mr-1 rounded px-1 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
