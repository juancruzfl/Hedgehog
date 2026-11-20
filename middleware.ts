import { NextResponse, type NextRequest } from "next/server";
import { signInMode } from "@/lib/auth/mode";
import { SESSION_COOKIE, sessionFromCookie } from "@/lib/auth/session";

// The product's pages are for signed-in users. This runs before anything renders (in the
// Node runtime, so it can check the session in the database): no session → the landing page,
// keeping the full address to come back to after connecting; signed in but no roles yet →
// the role picker. Each page's layout repeats the check (lib/auth/guard.ts).
export async function middleware(req: NextRequest) {
  if (signInMode() === "off") return NextResponse.next(); // no sign-in configured (local development)
  const s = await sessionFromCookie(req.cookies.get(SESSION_COOKIE)?.value);
  if (s && s.roles.length) return NextResponse.next();
  // The public address (behind Railway's proxy the request's own origin is internal).
  const origin = process.env.APP_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
  const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(new URL(s ? `/welcome?next=${next}` : `/?signin=required&next=${next}`, origin));
}

export const config = {
  matcher: ["/markets", "/crypto/:path*", "/business/:path*", "/positions/:path*"],
  runtime: "nodejs",
};
