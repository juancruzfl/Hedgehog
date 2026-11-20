"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Role } from "@/lib/auth/roles";

// The signed-in Gemini account (and the roles picked for it), shared by the nav, the account
// button and the role picker: fetched once, refreshed whenever GEMINI_CHANGED_EVENT fires.

export const GEMINI_CHANGED_EVENT = "hedgehog:gemini-changed";

export interface AccountStatus {
  connected: boolean;
  available?: boolean;
  env?: "sandbox" | "production";
  account?: string | null;
  roles?: Role[];
  /** "sandbox-key": signing in uses Hedgehog's shared Gemini sandbox account (OAuth pending). */
  mode?: "oauth" | "sandbox-key" | "off";
}

let status: AccountStatus | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshAccount(): Promise<void> {
  inflight ??= fetch("/api/auth/gemini/me", { cache: "no-store" })
    .then((r) => r.json() as Promise<AccountStatus>)
    .catch(() => ({ connected: false }))
    .then((s) => {
      status = s;
      emit();
    })
    .finally(() => (inflight = null));
  return inflight;
}

/** Sets the status directly (e.g. right after signing out or saving roles), then tells everyone. */
export function setAccount(s: AccountStatus) {
  status = s;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Null while loading. */
export function useAccount(): AccountStatus | null {
  const s = useSyncExternalStore(subscribe, () => status, () => null);
  useEffect(() => {
    if (status === null) void refreshAccount();
    const on = () => void refreshAccount();
    window.addEventListener(GEMINI_CHANGED_EVENT, on);
    return () => window.removeEventListener(GEMINI_CHANGED_EVENT, on);
  }, []);
  return s;
}
