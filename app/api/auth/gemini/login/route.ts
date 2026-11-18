import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, oauthConfig, redirectUri, safeNext } from "@/lib/auth/gemini-oauth";
import { setStateCookie } from "@/lib/auth/session";

// GET: send the user to Gemini to sign in and approve Hedgehog's access.
// `next` is where to land afterwards (a path on this site only).
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const cfg = oauthConfig();
  if (!cfg) return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}gemini=not-configured`, req.nextUrl.origin));

  // `state` ties the callback to this browser (CSRF) and carries the return path.
  const nonce = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(cfg, nonce, redirectUri(req.nextUrl.origin)));
  setStateCookie(res, JSON.stringify({ nonce, next }));
  return res;
}
