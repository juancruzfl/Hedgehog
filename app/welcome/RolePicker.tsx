"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BusinessIcon } from "@/components/BusinessIcon";
import { CoinIcon } from "@/components/CoinIcon";
import { setAccount, useAccount } from "@/components/useAccount";
import { ROLE_INFO, ROLES, type Role } from "@/lib/auth/roles";

// Right after connecting Gemini: crypto trader, small business owner, or both. The choice
// decides what shows in the nav. Can't continue with neither.

const ICONS: Record<Role, React.ReactNode> = {
  crypto: <CoinIcon asset="BTC" size="lg" />,
  business: (
    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
      <BusinessIcon who="Sports bar" className="h-6 w-6" />
    </span>
  ),
};

export function RolePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useAccount();
  const [picked, setPicked] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changing roles later: start from what they picked before.
  const saved = account?.roles?.join(",") ?? "";
  useEffect(() => {
    if (saved) setPicked(saved.split(",") as Role[]);
  }, [saved]);

  const toggle = (r: Role) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  async function save() {
    if (!picked.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: picked }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save that. Try again.");
      if (account) setAccount({ ...account, roles: body.roles });
      // Back to where they were when they connected; the landing page or nowhere means the product's home.
      const next = params.get("next");
      router.push(next && next !== "/" && !next.startsWith("/welcome") ? next : "/markets");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (!account) return <div className="h-80 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />;

  if (!account.connected) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Connect your Gemini account first</h1>
        <p className="mt-2 text-text-2">Hedgehog places hedges in your own Gemini account, so it starts there.</p>
        <a href="/api/auth/gemini/login?next=%2Fwelcome" className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
          Connect Gemini account
        </a>
      </div>
    );
  }

  const changing = !!saved;
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{changing ? "Your account" : "You're connected"}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">What do you want to hedge?</h1>
      <p className="mt-2 text-text-2">Pick one or both. You can change this any time from your account menu.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2" role="group" aria-label="What you hedge">
        {ROLES.map((r) => {
          const on = picked.includes(r);
          return (
            <button
              key={r}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(r)}
              className={`relative flex flex-col items-start gap-4 rounded-2xl border-2 bg-surface p-5 text-left transition sm:p-6 ${
                on ? "border-accent bg-accent-soft/40" : "border-border hover:border-text-3"
              }`}
            >
              <span
                className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold ${
                  on ? "border-accent bg-accent text-accent-ink" : "border-border bg-surface text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              {ICONS[r]}
              <span>
                <span className="block text-lg font-semibold">{ROLE_INFO[r].title}</span>
                <span className="mt-1 block text-[15px] leading-snug text-text-2">{ROLE_INFO[r].body}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={!picked.length || saving}
          className="rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
        {!picked.length && <span className="text-sm text-text-3">Pick at least one to continue.</span>}
      </div>
    </div>
  );
}
