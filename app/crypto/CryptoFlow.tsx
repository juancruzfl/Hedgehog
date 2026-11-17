"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { combineHoldings, isHedgeable, type Holding } from "@/lib/holdings";
import { STORAGE_KEYS } from "@/lib/legal";
import type { FAsset, FHorizon } from "./ForecastCard";
import { PinnedMarkets } from "./PinnedMarkets";
import { HedgeBuilder } from "./HedgeBuilder";
import { HoldingsDialog, type Method } from "./HoldingsDialog";

const STORAGE_KEY = STORAGE_KEYS.holdings; // listed on the Cookies & Storage page
/** Fired by the nav's "Edit assets" button. */
export const EDIT_ASSETS_EVENT = "hedgehog:edit-assets";

function loadHoldings(): Holding[] {
  try {
    // Drop anything malformed (old formats, hand edits) instead of crashing the page.
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (h): h is Holding =>
        !!h && typeof h.asset === "string" && typeof h.quantity === "number" && Number.isFinite(h.quantity) && h.quantity > 0 && typeof h.source === "string",
    );
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

  function protect(f: FAsset, h: FHorizon) {
    setBuilding({ asset: f.asset, marketId: h.marketId });
  }

  const header = (
    <div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl [@media(max-height:800px)]:text-3xl">How likely is your crypto to drop?</h1>
      {/* One short line so it always fits above the pinned market card */}
      <p className="mt-1.5 text-text-2 [@media(max-height:800px)]:mt-1 [@media(max-height:800px)]:text-sm">
        Live odds from Gemini prediction markets. Cushion a fall only if you want to.
      </p>
      {importNote && <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-2">{importNote}</p>}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );

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

      {combined.length > 0 && forecasts ? (
        <PinnedMarkets header={header} updating={loading} forecasts={forecasts} asOf={asOf} onProtect={protect} />
      ) : (
        <div className="space-y-8 pt-10">
          {header}
          {combined.length === 0 ? (
            <section className="flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-12 text-center">
              <p className="text-lg font-semibold">Start by telling us what you hold</p>
              <p className="mt-1 max-w-md text-sm text-text-2">Connect a wallet, import from Gemini, or type it in. Then you&apos;ll see the odds of a drop.</p>
              <button onClick={() => setDialogOpen(true)} className="mt-5 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
                Add what you hold
              </button>
            </section>
          ) : (
            !error && <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" aria-label="Loading odds" />
          )}
        </div>
      )}

      {/* The builder opens as a popup over the market cards. */}
      {building &&
          (() => {
            const held = combined.find((c) => c.asset === building.asset)?.quantity ?? 0;
            // If the coin was removed, there's nothing to hedge.
            return held > 0 ? (
              <HedgeBuilder key={`${building.asset}-${building.marketId}`} {...building} quantity={held} onClose={() => setBuilding(null)} />
            ) : null;
          })()}
    </div>
  );
}
