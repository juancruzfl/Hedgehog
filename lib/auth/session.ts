import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NextRequest, NextResponse } from "next/server";
import { GeminiApiError, GeminiClient } from "@/lib/venues/gemini/client";
import { oauthConfig, refreshTokens, type GeminiEnv, type TokenSet } from "./gemini-oauth";

// A browser session holding one connected Gemini account.
// - The cookie carries only a random session id; the table stores its SHA-256, so a leaked
//   database can't be turned back into a working cookie.
// - Gemini tokens are encrypted at rest (AES-256-GCM, key from SESSION_SECRET).

export const SESSION_COOKIE = "hh_session";
export const STATE_COOKIE = "hh_oauth_state";
const SESSION_DAYS = 30;
const REFRESH_EARLY_MS = 5 * 60_000;

const DB_PATH = process.env.HEDGES_DB_PATH ?? path.join(process.cwd(), "data", "hedgehog.sqlite");
let db: DatabaseSync | null = null;
function sessionsDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      env TEXT NOT NULL,
      account TEXT,
      access_enc TEXT NOT NULL,
      refresh_enc TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT NOT NULL
    );
  `);
  return db;
}

// ---------- encryption ----------

let devKeyWarned = false;
function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set to store Gemini sign-ins.");
    if (!devKeyWarned) console.warn("[auth] SESSION_SECRET not set; using a dev-only key. Set it before deploying.");
    devKeyWarned = true;
  }
  return createHash("sha256").update(secret ?? "hedgehog-dev-only-session-key").digest();
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const hashId = (id: string) => createHash("sha256").update(id).digest("hex");

// ---------- sessions ----------

export interface GeminiSession {
  idHash: string;
  env: GeminiEnv;
  account: string | null;
  tokens: TokenSet;
}

interface Row {
  id_hash: string;
  env: string;
  account: string | null;
  access_enc: string;
  refresh_enc: string;
  expires_at: number;
  scope: string;
}

export function createSession(env: GeminiEnv, tokens: TokenSet, account: string | null): string {
  const id = randomBytes(32).toString("base64url");
  sessionsDb()
    .prepare(`INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(hashId(id), Date.now(), env, account, encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiresAt, tokens.scope);
  return id;
}

function load(idHash: string): GeminiSession | null {
  const row = sessionsDb().prepare(`SELECT * FROM sessions WHERE id_hash = ?`).get(idHash) as Row | undefined;
  if (!row) return null;
  try {
    return {
      idHash: row.id_hash,
      env: row.env === "production" ? "production" : "sandbox",
      account: row.account,
      tokens: { accessToken: decrypt(row.access_enc), refreshToken: decrypt(row.refresh_enc), expiresAt: row.expires_at, scope: row.scope },
    };
  } catch {
    return null; // SESSION_SECRET changed: treat as signed out
  }
}

function saveTokens(idHash: string, t: TokenSet) {
  sessionsDb()
    .prepare(`UPDATE sessions SET access_enc = ?, refresh_enc = ?, expires_at = ?, scope = ? WHERE id_hash = ?`)
    .run(encrypt(t.accessToken), encrypt(t.refreshToken), t.expiresAt, t.scope, idHash);
}

export function deleteSession(idHash: string) {
  sessionsDb().prepare(`DELETE FROM sessions WHERE id_hash = ?`).run(idHash);
}

// One refresh at a time per session: refresh tokens work once, so two parallel refreshes
// would sign the user out.
const refreshing = new Map<string, Promise<GeminiSession | null>>();

async function fresh(s: GeminiSession): Promise<GeminiSession | null> {
  if (s.tokens.expiresAt - Date.now() > REFRESH_EARLY_MS) return s;
  const cfg = oauthConfig();
  if (!cfg) return null;
  let p = refreshing.get(s.idHash);
  if (!p) {
    p = refreshTokens(cfg, s.tokens.refreshToken)
      .then((tokens) => {
        saveTokens(s.idHash, tokens);
        return { ...s, tokens };
      })
      .catch(() => {
        deleteSession(s.idHash); // refresh token revoked or used: sign in again
        return null;
      })
      .finally(() => refreshing.delete(s.idHash));
    refreshing.set(s.idHash, p);
  }
  return p;
}

/** The signed-in Gemini session for this request, refreshed if its access token is about to expire. */
export async function getSession(req: NextRequest): Promise<GeminiSession | null> {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const s = load(hashId(id));
  return s ? fresh(s) : null;
}

/** A Gemini client acting as the signed-in user, or null when nobody is connected. */
export async function userGeminiClient(req: NextRequest): Promise<GeminiClient | null> {
  const s = await getSession(req);
  if (!s) return null;
  return new GeminiClient({
    accessToken: s.tokens.accessToken,
    tradingEnv: s.env,
    marketDataEnv: (process.env.GEMINI_MARKET_DATA_ENV as GeminiEnv) ?? "production",
  });
}

/**
 * The Gemini account to use for this request: the signed-in user's. The server's own API
 * key is only a local-development fallback, used when Gemini sign-in isn't configured.
 */
export async function geminiClientFor(req: NextRequest): Promise<GeminiClient | null> {
  const user = await userGeminiClient(req);
  if (user) return user;
  if (oauthConfig()) return null;
  const server = GeminiClient.fromEnv();
  return server.hasCredentials ? server : null;
}

const secure = () => (process.env.APP_URL ?? "").startsWith("https://") || process.env.NODE_ENV === "production";

export function setSessionCookie(res: NextResponse, id: string) {
  res.cookies.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: SESSION_DAYS * 86_400 });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 0 });
}

export function setStateCookie(res: NextResponse, value: string) {
  // Lax so it survives the top-level redirect back from Gemini.
  res.cookies.set(STATE_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/api/auth/gemini", maxAge: 600 });
}

export function clearStateCookie(res: NextResponse) {
  res.cookies.set(STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secure(), path: "/api/auth/gemini", maxAge: 0 });
}

/** Gemini answered 401/403 to a signed-in user's token: revoked or expired, so they need to sign in again. */
export const isSignInExpired = (e: unknown) => e instanceof GeminiApiError && (e.status === 401 || e.status === 403);
export const SIGN_IN_EXPIRED = "Your Gemini sign-in has expired. Connect your Gemini account again.";
