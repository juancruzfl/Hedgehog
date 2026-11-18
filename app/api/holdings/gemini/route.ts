import { NextResponse, type NextRequest } from "next/server";
import { SIGN_IN_EXPIRED, geminiClientFor, isSignInExpired } from "@/lib/auth/session";
import { getGeminiAccount } from "@/lib/holdings/gemini";

// GET: crypto and USD in the signed-in user's Gemini account.
export async function GET(req: NextRequest) {
  const client = await geminiClientFor(req);
  if (!client) {
    return NextResponse.json({ error: "Connect your Gemini account first (top right).", needsConnect: true }, { status: 409 });
  }
  try {
    const account = await getGeminiAccount(client);
    return NextResponse.json({ ...account, env: client.tradingEnv });
  } catch (e) {
    if (isSignInExpired(e)) return NextResponse.json({ error: SIGN_IN_EXPIRED, needsConnect: true }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
