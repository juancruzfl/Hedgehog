import { NextResponse, type NextRequest } from "next/server";
import { SIGN_IN_EXPIRED, geminiClientFor, isSignInExpired } from "@/lib/auth/session";
import { ApprovedHedge, executeHedge, executionMode } from "@/lib/hedges/execute";
import { GeminiAdapter } from "@/lib/venues/gemini/adapter";
import { getVenue } from "@/lib/venues";

// POST: place the orders for a hedge the user explicitly approved.
export async function POST(req: NextRequest) {
  const parsed = ApprovedHedge.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid hedge", issues: parsed.error.issues }, { status: 400 });
  // Live orders go to the signed-in user's own Gemini account; paper fills need no account.
  const live = executionMode() === "live";
  const client = live ? await geminiClientFor(req) : null;
  if (live && !client) {
    return NextResponse.json({ error: "Connect your Gemini account before placing hedges.", needsConnect: true }, { status: 409 });
  }
  try {
    const result = await executeHedge(client ? new GeminiAdapter(client) : getVenue(), parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    if (isSignInExpired(e)) return NextResponse.json({ error: SIGN_IN_EXPIRED, needsConnect: true }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
