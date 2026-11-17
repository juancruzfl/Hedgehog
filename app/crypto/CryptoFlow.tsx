"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { StepHeading } from "@/components/ui";
import { combineHoldings, isHedgeable, type Holding } from "@/lib/holdings";
import { ForecastCard, type FAsset, type FHorizon } from "./ForecastCard";
import { useScrollFocus } from "./useScrollFocus";
import { HedgeBuilder } from "./HedgeBuilder";
import { HoldingsDialog, type Method } from "./HoldingsDialog";

const STORAGE_KEY = "hedgehog.holdings.v1";
/** Fired by the nav's "Edit assets" button. */
export const EDIT_ASSETS_EVENT = "hedgehog:edit-assets";

function loadHoldings(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function CryptoFlow() {
  const params = useSearchParams();
  const initialAsset = params.get("asset")?.toUpperCase() ?? null;
  const [importNote, setImportNote] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [forecasts, setForecasts] = useState<FAsset[] | null>(null);
  const [asOf, setAsOf] = useState(0);
  // Last known price per coin (kept while a new forecast loads) for dollar values.
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the coin and date are remembered; the amount always comes from current holdings.
  const [building, setBuilding] = useState<{ asset: string; marketId: string } | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Arriving from a landing card ("SOL holder") with a coin but no amount opens manual entry for it.
  const [dialogMethod] = useState<Method | null>(initialAsset && !params.get("qty") ? "manual" : null);

  // Load saved holdings, then apply anything passed from the landing page:
  // ?asset=SOL&qty=20 adds/updates a typed-in holding; ?wallet=<address> reads a Solana wallet.
  useEffect(() => {
    let h = loadHoldings();
    const qty = Number(params.get("qty"));
    if (initialAsset && isHedgeable(initialAsset) && qty > 0) {
      h = [...h.filter((x) => !(x.source === "manual" && x.asset === initialAsset)), { asset: initialAsset, quantity: qty, source: "manual", detail: `${initialAsset} entered by you` }];
    }
    setHoldings(h);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
    } catch {}

    const wallet = params.get("wallet");
    // Nothing saved and nothing coming in: start by asking what they hold.
    if (h.length === 0 && !wallet) setDialogOpen(true);
    if (wallet) {
      setImportNote("Reading your Solana wallet…");
      fetch(`/api/holdings/solana?address=${encodeURIComponent(wallet)}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          const found = (body.holdings as Holding[]).filter((x) => isHedgeable(x.asset));
          setHoldings((prev) => {
            const next = [...prev.filter((x) => x.source !== "solana"), ...found];
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
          setImportNote(found.length ? null : "No SOL, BTC or ETH found in that wallet.");
        })
        .catch((e) => setImportNote(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The nav's "Edit assets" button reopens the popup.
  useEffect(() => {
    const open = () => setDialogOpen(true);
    window.addEventListener(EDIT_ASSETS_EVENT, open);
    return () => window.removeEventListener(EDIT_ASSETS_EVENT, open);
  }, []);

  const update = (h: Holding[]) => {
    setHoldings(h);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
    } catch {}
  };

  const combined = useMemo(() => combineHoldings(holdings).filter((c) => isHedgeable(c.asset)), [holdings]);
  const key = combined.map((c) => `${c.asset}:${c.quantity}`).join(",");

  useEffect(() => {
    if (!combined.length) {
      setForecasts(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings: combined.map(({ asset, quantity }) => ({ asset, quantity })) }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setForecasts(body.forecasts);
        setAsOf(new Date(body.asOf).getTime());
        setPrices((prev) => ({ ...prev, ...Object.fromEntries((body.forecasts as FAsset[]).map((f) => [f.asset, f.spot])) }));
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The market card nearest the middle of the screen is "in focus"; others dim.
  const { active, register } = useScrollFocus(forecasts?.map((f) => f.asset) ?? []);

  function protect(f: FAsset, h: FHorizon) {
    setBuilding({ asset: f.asset, marketId: h.marketId });
    setTimeout(() => builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="space-y-6">
      <HoldingsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        holdings={holdings}
        onChange={update}
        prices={prices}
        initialMethod={dialogMethod}
        initialAsset={initialAsset}
      />

      {importNote && <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-2">{importNote}</p>}

      {combined.length === 0 ? (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-12 text-center">
          <p className="text-lg font-semibold">Start by telling us what you hold</p>
          <p className="mt-1 max-w-md text-sm text-text-2">Connect a wallet, import from Gemini, or type it in. Then you&apos;ll see the odds of a drop.</p>
          <button onClick={() => setDialogOpen(true)} className="mt-5 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
            Add what you hold
          </button>
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <StepHeading n={1} title="How likely is a drop?" sub="The odds come from live Gemini prediction markets, where people trade on where prices will end." />
              {loading && <span className="shrink-0 pt-1 text-sm text-text-3">Updating…</span>}
            </div>
            {error && <p className="text-sm text-bad">{error}</p>}
            {!forecasts && !error && <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" aria-label="Loading odds" />}
            {forecasts?.map((f) => {
              const focused = active === null || active === f.asset || forecasts.length === 1;
              return (
                <div
                  key={f.asset}
                  ref={register(f.asset)}
                  data-focused={focused}
                  className={`snap-center rounded-2xl transition duration-300 ease-out motion-reduce:transition-none ${
                    focused ? "scale-100 opacity-100 ring-2 ring-accent" : "scale-[0.97] opacity-45"
                  }`}
                >
                  <ForecastCard f={f} asOf={asOf} onProtect={(h) => protect(f, h)} />
                </div>
              );
            })}
          </section>
        </>
      )}

      <div ref={builderRef} className="scroll-mt-20">
        {building &&
          (() => {
            const held = combined.find((c) => c.asset === building.asset)?.quantity ?? 0;
            // If the coin was removed, there's nothing to hedge.
            return held > 0 ? (
              <HedgeBuilder key={`${building.asset}-${building.marketId}`} {...building} quantity={held} onClose={() => setBuilding(null)} />
            ) : null;
          })()}
      </div>
    </div>
  );
}
