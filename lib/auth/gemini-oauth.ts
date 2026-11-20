// "Connect Gemini account": OAuth 2.0 authorization-code flow (confidential client).
// Docs: https://developer.gemini.com/authentication/oauth
//
// The user signs in on Gemini and approves the scopes below. Gemini redirects back with a
// code; the server swaps it for an access token (24h) and a one-time-use refresh token.
// Orders, balances and positions then go to THAT user's account, never a shared key.

export type GeminiEnv = "sandbox" | "production";

/** What Hedgehog asks for: read the account and balances, read and place prediction-market orders. */
export const DEFAULT_SCOPES = ["account:read", "balances:read", "orders:read", "orders:create"];

const AUTH_HOSTS: Record<GeminiEnv, string> = {
  sandbox: "https://exchange.sandbox.gemini.com",
  production: "https://exchange.gemini.com",
};

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  env: GeminiEnv;
  scopes: string[];
}

export function oauthConfig(): OAuthConfig | null {
  const clientId = process.env.GEMINI_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GEMINI_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    env: process.env.GEMINI_OAUTH_ENV === "production" ? "production" : "sandbox",
    scopes: process.env.GEMINI_OAUTH_SCOPES?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_SCOPES,
  };
}

/**
 * This site's public address. Behind a proxy (Railway) the request's own origin is the
 * internal one (https://localhost:8080), so redirects use APP_URL when it's set.
 */
export function siteOrigin(requestOrigin: string): string {
  return process.env.APP_URL?.replace(/\/+$/, "") || requestOrigin;
}

/** Where Gemini sends the user back. Must match the redirect URI registered on the app exactly. */
export function redirectUri(origin: string): string {
  return process.env.GEMINI_OAUTH_REDIRECT_URI ?? `${process.env.APP_URL ?? origin}/api/auth/gemini/callback`;
}

/** Only same-site paths, so sign-in can't be used to bounce people to another site. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function authorizeUrl(cfg: OAuthConfig, state: string, redirect: string): string {
  const url = new URL("/auth", AUTH_HOSTS[cfg.env]);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", cfg.scopes.join(",")); // comma-separated, no spaces
  return url.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
  scope: string;
}

export class GeminiOAuthError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    const b = body as { error?: string; error_description?: string } | null;
    super(`Gemini sign-in failed (${status}): ${b?.error_description ?? b?.error ?? "unknown error"}`);
  }
}

async function tokenRequest(cfg: OAuthConfig, fields: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(new URL("/auth/token", AUTH_HOSTS[cfg.env]), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...fields }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  } | null;
  if (!res.ok || !body?.access_token || !body.refresh_token) throw new GeminiOAuthError(res.status, body);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (body.expires_in ?? 86_399) * 1000,
    scope: body.scope ?? cfg.scopes.join(","),
  };
}

export const exchangeCode = (cfg: OAuthConfig, code: string, redirect: string) =>
  tokenRequest(cfg, { code, redirect_uri: redirect, grant_type: "authorization_code" });

/** Refresh tokens are one-time use: the response carries the next one, which must be saved. */
export const refreshTokens = (cfg: OAuthConfig, refreshToken: string) =>
  tokenRequest(cfg, { refresh_token: refreshToken, grant_type: "refresh_token" });

/** Best effort: Gemini answers 200 even for an already-revoked token. */
export async function revokeToken(cfg: OAuthConfig, token: string): Promise<void> {
  await fetch(new URL("/auth/token/revoke", AUTH_HOSTS[cfg.env]), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, token }),
    cache: "no-store",
  }).catch(() => undefined);
}
