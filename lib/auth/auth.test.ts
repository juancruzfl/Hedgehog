import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { authorizeUrl, safeNext, type OAuthConfig } from "./gemini-oauth";
import { decrypt, encrypt } from "./session";

const cfg: OAuthConfig = { clientId: "app-id", clientSecret: "shh", env: "sandbox", scopes: ["balances:read", "orders:create"] };

describe("Gemini sign-in URL", () => {
  it("asks the sandbox for a code with comma-separated scopes and the state", () => {
    const u = new URL(authorizeUrl(cfg, "abc123", "http://localhost:3000/api/auth/gemini/callback"));
    expect(u.origin + u.pathname).toBe("https://exchange.sandbox.gemini.com/auth");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("app-id");
    expect(u.searchParams.get("scope")).toBe("balances:read,orders:create");
    expect(u.searchParams.get("state")).toBe("abc123");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/gemini/callback");
    expect(u.toString()).not.toContain("shh"); // the secret never goes to the browser
  });

  it("uses exchange.gemini.com in production", () => {
    expect(authorizeUrl({ ...cfg, env: "production" }, "s", "https://x/cb")).toMatch(/^https:\/\/exchange\.gemini\.com\/auth\?/);
  });
});

describe("return path after sign-in", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/crypto")).toBe("/crypto");
    expect(safeNext("/positions?tab=finished")).toBe("/positions?tab=finished");
  });
  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", null, ""]) expect(safeNext(bad)).toBe("/");
  });
});

describe("token encryption", () => {
  it("round-trips and never stores the token in plain text", () => {
    const blob = encrypt("d9af2411-3e85-41bb-89f4-cf53750f04df");
    expect(blob).not.toContain("d9af2411");
    expect(decrypt(blob)).toBe("d9af2411-3e85-41bb-89f4-cf53750f04df");
  });
  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });
  it("rejects tampered data", () => {
    const [iv, tag, data] = encrypt("token").split(".");
    expect(() => decrypt([iv, tag, data.slice(0, -2) + (data.endsWith("A") ? "BB" : "AA")].join("."))).toThrow();
  });
});

describe("GeminiClient with a signed-in user's token", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a Bearer token and a payload without a nonce or API key", async () => {
    const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GeminiClient({ accessToken: "tok-1", tradingEnv: "sandbox" });
    expect(client.hasCredentials).toBe(true);
    await client.privatePost("/v1/balances");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.sandbox.gemini.com/v1/balances");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers["X-GEMINI-APIKEY"]).toBeUndefined();
    expect(headers["X-GEMINI-SIGNATURE"]).toBeUndefined();
    const payload = JSON.parse(Buffer.from(headers["X-GEMINI-PAYLOAD"], "base64").toString());
    expect(payload).toEqual({ request: "/v1/balances" });
  });
});
