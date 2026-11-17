// Live spot prices from Hyperliquid's public info API (no key).
// Some Gemini contracts (e.g. Brent oil) settle on Hyperliquid-derived indices;
// BTC settles on a different index (see each contract's rulesText), so this is
// a live reference price, not necessarily the settlement source.

const INFO_URL = "https://api.hyperliquid.xyz/info";

export async function getMids(): Promise<Record<string, number>> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid allMids failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, string>;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
}

export async function getSpot(asset: string): Promise<number> {
  const mids = await getMids();
  const px = mids[asset.toUpperCase()];
  if (!px) throw new Error(`No Hyperliquid price for ${asset}`);
  return px;
}
