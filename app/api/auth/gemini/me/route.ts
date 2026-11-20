import { NextResponse, type NextRequest } from "next/server";
import { signInMode } from "@/lib/auth/mode";
import { getSession } from "@/lib/auth/session";

// GET: is a Gemini account connected in this browser? Never returns tokens.
export async function GET(req: NextRequest) {
  const s = await getSession(req);
  const res = NextResponse.json(
    s
      ? { connected: true, env: s.env, account: s.account, scopes: s.tokens.scope.split(","), roles: s.roles, mode: s.kind }
      : { connected: false, available: signInMode() !== "off", mode: signInMode() },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
