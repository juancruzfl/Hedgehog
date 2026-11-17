"use client";

import { CoinIcon } from "@/components/CoinIcon";
import { PinnedStage } from "@/components/PinnedStage";
import { ForecastCard, type FAsset, type FHorizon } from "./ForecastCard";

/** Each coin's markets in the shared scroll-in-place stage, with a coin chip row. */
export function PinnedMarkets({
  header,
  updating,
  forecasts,
  asOf,
  onProtect,
}: {
  header: (current: FAsset | null) => React.ReactNode;
  updating: boolean;
  forecasts: FAsset[];
  asOf: number;
  onProtect: (f: FAsset, h: FHorizon) => void;
}) {
  return (
    <PinnedStage
      header={(i) => header(i === null ? null : forecasts[i])}
      status={updating ? "Updating odds…" : null}
      items={forecasts.map((f) => ({
        key: f.asset,
        label: f.asset,
        chip: (
          <>
            <CoinIcon asset={f.asset} size="sm" />
            {f.asset}
          </>
        ),
      }))}
      renderCard={(i, pinned) => <ForecastCard f={forecasts[i]} asOf={asOf} onProtect={(h) => onProtect(forecasts[i], h)} showHolding={!pinned} />}
    />
  );
}
