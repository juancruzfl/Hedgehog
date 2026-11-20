import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, oauthConfig, redirectUri, safeNext, siteOrigin } from "@/lib/auth/gemini-oauth";
import { STATE_COOKIE, clearStateCookie, createSession, setSessionCookie } from "@/lib/auth/session";
import { GeminiClient } from "@/lib/venues/gemini/client";

// GET: Gemini sends the user back here with ?code&state after they approve (or ?error if not).
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  let saved: { nonce?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}
  const next = safeNext(saved.next ?? null);
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}gemini=${status}`, siteOrigin(req.nextUrl.origin)));
    clearStateCookie(res);
    return res;
  };

  const cfg = oauthConfig();
  if (!cfg) return back("not-configured");
  if (p.get("error")) return back("cancelled"); // they said no on Gemini's screen
  const code = p.get("code");
  if (!code || !saved.nonce || p.get("state") !== saved.nonce) return back("error");

  try {
    const tokens = await exchangeCode(cfg, code, redirectUri(siteOrigin(req.nextUrl.origin)));
    // A name to show in the menu. Optional: the connection works without it.
    let account: string | null = null;
    try {
      const client = new GeminiClient({ accessToken: tokens.accessToken, tradingEnv: cfg.env });
      const a = await client.privatePost<{ account?: { accountName?: string }; users?: { name?: string }[] }>("/v1/account");
      account = a.users?.[0]?.name ?? a.account?.accountName ?? null;
    } catch {}
    const id = createSession(cfg.env, tokens, account);
    // Next: say what they came to hedge (crypto, business or both), then on to where they were.
    const res = NextResponse.redirect(new URL(`/welcome?gemini=connected&next=${encodeURIComponent(next)}`, siteOrigin(req.nextUrl.origin)));
    clearStateCookie(res);
    setSessionCookie(res, id);
    return res;
  } catch (e) {
    console.error("[auth] Gemini code exchange failed:", (e as Error).message);
    return back("error");
  }
}
