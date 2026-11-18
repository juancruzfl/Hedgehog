import { describe, expect, it, vi } from "vitest";
import { swr } from "./cache";

describe("swr", () => {
  it("returns the cached value without reloading while fresh", async () => {
    const load = vi.fn(async () => 1);
    expect(await swr("fresh", 60_000, load)).toBe(1);
    expect(await swr("fresh", 60_000, load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value immediately and refreshes in the background", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    expect(await swr("stale", 0, load)).toBe(1);
    expect(await swr("stale", 0, load)).toBe(1); // stale, refresh kicked off
    await new Promise((r) => setTimeout(r, 0));
    expect(await swr("stale", 60_000, load)).toBe(2);
  });

  it("shares one request between concurrent misses", async () => {
    const load = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(7), 10)));
    const [a, b] = await Promise.all([swr("shared", 1000, load), swr("shared", 1000, load)]);
    expect([a, b]).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("doesn't store failures", async () => {
    await expect(swr("fail", 1000, async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(await swr("fail", 1000, async () => 3)).toBe(3);
  });
});
