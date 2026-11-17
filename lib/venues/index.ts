import { GeminiAdapter } from "./gemini/adapter";
import type { VenueAdapter } from "./types";

// Venue registry. Gemini is the default; add new adapters here (e.g. kalshi).
const factories: Record<string, () => VenueAdapter> = {
  gemini: () => new GeminiAdapter(),
};

const cache = new Map<string, VenueAdapter>();

export function getVenue(name = "gemini"): VenueAdapter {
  const factory = factories[name];
  if (!factory) throw new Error(`Unknown venue: ${name}`);
  if (!cache.has(name)) cache.set(name, factory());
  return cache.get(name)!;
}

export const venueNames = () => Object.keys(factories);
