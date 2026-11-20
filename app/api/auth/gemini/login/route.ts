import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, oauthConfig, redirectUri, safeNext, siteOrigin } from "@/lib/auth/gemini-oauth";
import { signInMode } from "@/lib/auth/mode";
import { createSandboxSession, setSessionCookie, setStateCookie } from "@/lib/auth/session";

// GET: send the user to Gemini to sign in and approve Hedgehog's access.
// `next` is where to land afterwards (a path on this site only).
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  // OAuth approval pending: sign in to Hedgehog's shared Gemini sandbox account instead.
  // Everyone shares this account, so it gets a generic name: the account's real name is its
  // owner's login (an email) and must not be shown to visitors.
  if (signInMode() === "sandbox-key") {
    const res = NextResponse.redirect(new URL(`/welcome?gemini=connected&next=${encodeURIComponent(next)}`, siteOrigin(req.nextUrl.origin)));
    setSessionCookie(res, createSandboxSession("Hedgehog demo account"));
    return res;
  }

  const cfg = oauthConfig();
  if (!cfg) return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}gemini=not-configured`, siteOrigin(req.nextUrl.origin)));

  // `state` ties the callback to this browser (CSRF) and carries the return path.
  const nonce = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(cfg, nonce, redirectUri(siteOrigin(req.nextUrl.origin))));
  setStateCookie(res, JSON.stringify({ nonce, next }));
  return res;
}
