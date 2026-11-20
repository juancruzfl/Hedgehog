import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { signInMode } from "./mode";
import { SESSION_COOKIE, createSandboxSession, geminiClientFor, getSession } from "./session";

const reset = () => delete (globalThis as { __geminiClient?: unknown }).__geminiClient; // GeminiClient.fromEnv caches
const reqWith = (id?: string) => ({ cookies: { get: (n: string) => (n === SESSION_COOKIE && id ? { value: id } : undefined) } }) as unknown as NextRequest;

describe("sandbox sign-in (OAuth approval pending)", () => {
  beforeEach(() => {
    reset();
    vi.stubEnv("GEMINI_OAUTH_CLIENT_ID", "");
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("GEMINI_API_SECRET", "secret");
    vi.stubEnv("GEMINI_TRADING_ENV", "sandbox");
    vi.stubEnv("GEMINI_SIGN_IN", "sandbox-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    reset();
  });

  it("is on only with a sandbox key", () => {
    expect(signInMode()).toBe("sandbox-key");
    reset();
    vi.stubEnv("GEMINI_TRADING_ENV", "production");
    expect(signInMode()).toBe("off"); // never hands out a production account
  });

  it("signs in to the shared sandbox account, and only signed-in visitors get it", async () => {
    const id = createSandboxSession("Demo (sandbox)");
    const s = (await getSession(reqWith(id)))!;
    expect(s).toMatchObject({ kind: "sandbox-key", env: "sandbox", account: "Demo (sandbox)", roles: [] });
    expect((await geminiClientFor(reqWith(id)))?.tradingEnv).toBe("sandbox");
    expect(await geminiClientFor(reqWith())).toBeNull();
  });

  it("ends those sessions if sandbox sign-in is switched off", async () => {
    const id = createSandboxSession(null);
    vi.stubEnv("GEMINI_SIGN_IN", "");
    expect(await getSession(reqWith(id))).toBeNull();
  });
});
