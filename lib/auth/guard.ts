import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { signInMode } from "./mode";
import { SESSION_COOKIE, getSession, sessionFromCookie, type GeminiSession } from "./session";

// The product's pages (/markets, /crypto, /business, /positions) are for signed-in users.
// middleware.ts gates them before anything renders; requireSignIn repeats the check in each
// page's layout, and apiSignInRequired guards the API routes behind those pages.
// Public: the landing page, past promos, the archive, hedge receipts and the legal pages.
// When no sign-in is configured at all (local development without Gemini), pages stay open.

export const SIGN_IN_REQUIRED = "Connect your Gemini account first.";

/** For a protected page: signed in, with at least one role, or redirected. */
export async function requireSignIn(path: string): Promise<GeminiSession | null> {
  if (signInMode() === "off") return null;
  const s = await sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) redirect(`/?signin=required&next=${encodeURIComponent(path)}`);
  if (!s.roles.length) redirect(`/welcome?next=${encodeURIComponent(path)}`);
  return s;
}

/** For an API route behind a protected page: a 401 response when nobody is signed in, else null. */
export async function apiSignInRequired(req: NextRequest): Promise<NextResponse | null> {
  if (signInMode() === "off") return null;
  return (await getSession(req)) ? null : NextResponse.json({ error: SIGN_IN_REQUIRED, needsConnect: true }, { status: 401 });
}
