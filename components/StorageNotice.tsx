"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/legal";

/** One-time, dismissible notice: no cookies; holdings are saved in the browser. */
export function StorageNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STORAGE_KEYS.notice) !== "dismissed");
    } catch {
      setShow(false); // storage blocked: nothing is saved, so nothing to tell
    }
  }, []);

  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.notice, "dismissed");
    } catch {}
    setShow(false);
  };

  return (
    <div role="region" aria-label="Storage notice" className="fixed inset-x-3 bottom-3 z-30 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm shadow-lg shadow-black/5">
        <p className="font-semibold">No cookies here</p>
        <p className="mt-1 text-text-2">
          Hedgehog saves what you hold in your browser so you don&apos;t have to re-enter it. No tracking, no ads.{" "}
          <Link href="/legal/cookies" className="text-accent underline underline-offset-2">
            Learn more
          </Link>
        </p>
        <button onClick={dismiss} className="mt-3 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink hover:brightness-110">
          Got it
        </button>
      </div>
    </div>
  );
}
