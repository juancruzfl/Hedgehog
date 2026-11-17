import { NextResponse } from "next/server";
import { getGeminiAccount } from "@/lib/holdings/gemini";
import { GeminiClient } from "@/lib/venues/gemini/client";

export async function GET() {
  const client = GeminiClient.fromEnv();
  if (!client.hasCredentials) {
    return NextResponse.json({ error: "Gemini isn't connected yet." }, { status: 409 });
  }
  try {
    const account = await getGeminiAccount(client);
    return NextResponse.json({ ...account, env: process.env.GEMINI_TRADING_ENV ?? "sandbox" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
