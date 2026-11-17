"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { combineHoldings, isHedgeable, type Holding } from "@/lib/holdings";
import { ForecastCard, type FAsset, type FHorizon } from "./ForecastCard";
import { HedgeBuilder } from "./HedgeBuilder";
import { HoldingsPanel } from "./HoldingsPanel";

const STORAGE_KEY = "hedgehog.holdings.v1";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ asset: string; quantity: number; marketId: string } | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);

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
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function protect(f: FAsset, h: FHorizon) {
    setBuilding({ asset: f.asset, quantity: f.quantity, marketId: h.marketId });
    setTimeout(() => builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="space-y-6">
      {importNote && <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-2">{importNote}</p>}
      <HoldingsPanel holdings={holdings} onChange={update} initialAsset={initialAsset} />

      {combined.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Your risk forecast</h2>
            {loading && <span className="text-sm text-text-3">Updating…</span>}
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          {forecasts?.map((f) => <ForecastCard key={f.asset} f={f} asOf={asOf} onProtect={(h) => protect(f, h)} />)}
        </section>
      )}

      <div ref={builderRef}>
        {building && (
          <HedgeBuilder key={`${building.asset}-${building.marketId}`} {...building} onClose={() => setBuilding(null)} />
        )}
      </div>
    </div>
  );
}
