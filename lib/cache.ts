// Small in-memory cache for slow server reads (Gemini market listings for the landing
// page and the game-day example). Within `ttlMs` it returns the stored value. After that
// it still returns the stored value immediately and refreshes in the background
// ("stale-while-revalidate"), so visitors never wait on Gemini once it's warm.
// Concurrent misses share one request. Failures aren't stored.

interface Entry {
  value: unknown;
  at: number;
  refreshing?: Promise<void>;
}

const g = globalThis as unknown as { __hhCache?: Map<string, Entry>; __hhInflight?: Map<string, Promise<unknown>> };
const store = (g.__hhCache ??= new Map());
const inflight = (g.__hhInflight ??= new Map());

export async function swr<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit) {
    if (Date.now() - hit.at >= ttlMs && !hit.refreshing) {
      hit.refreshing = load()
        .then((value) => void store.set(key, { value, at: Date.now() }))
        .catch((e) => console.error(`[cache] refreshing ${key} failed:`, (e as Error).message))
        .finally(() => {
          hit.refreshing = undefined;
        });
    }
    return hit.value as T;
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
