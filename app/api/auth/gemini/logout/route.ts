import { NextResponse, type NextRequest } from "next/server";
import { oauthConfig, revokeToken } from "@/lib/auth/gemini-oauth";
import { clearSessionCookie, deleteSession, getSession } from "@/lib/auth/session";

// POST: sign out. Revokes the Gemini refresh token so the connection can't be reused.
export async function POST(req: NextRequest) {
  const s = await getSession(req);
  const cfg = oauthConfig();
  if (s) {
    if (cfg && s.kind === "oauth") await revokeToken(cfg, s.tokens.refreshToken);
    deleteSession(s.idHash);
  }
  const res = NextResponse.json({ connected: false });
  clearSessionCookie(res);
  return res;
}
