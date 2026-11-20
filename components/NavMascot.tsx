"use client";

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/legal";
import { HedgehogBall, Logo } from "./Logo";

/**
 * The nav's wordmark and mascot. On the first page load of a visit, the hedgehog sits over
 * the hidden wordmark, gets startled, curls into a ball and rolls right, revealing
 * "hedgehog", then uncurls in its spot to the right of the text. All CSS (globals.css,
 * "Nav intro"); it plays only on screens wide enough to show the wordmark, never for
 * reduced-motion users, and once per browser session (layout.tsx marks <html> once seen).
 */
export function NavMascot() {
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.introSeen, "1");
    } catch {}
  }, []);

  return (
    <span className="hh-intro relative inline-flex h-10 items-center pr-10 sm:pr-12">
      <span className="hh-word hidden text-base font-bold tracking-tight sm:inline">hedgehog</span>
      <span className="hh-mascot absolute top-0 h-10 w-10">
        <span className="hh-char absolute inset-0">
          <Logo className="h-10 w-10 text-text" />
        </span>
        <span className="hh-ball absolute inset-0">
          <HedgehogBall className="h-10 w-10 text-text" />
        </span>
        <span className="hh-bang absolute -right-1.5 top-0 text-sm font-black leading-none text-text" aria-hidden>
          !
        </span>
      </span>
    </span>
  );
}
