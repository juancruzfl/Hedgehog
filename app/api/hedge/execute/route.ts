import { NextResponse, type NextRequest } from "next/server";
import { ApprovedHedge, executeHedge, executionMode } from "@/lib/hedges/execute";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { getVenue } from "@/lib/venues";

// POST: place the orders for a hedge the user explicitly approved.
export async function POST(req: NextRequest) {
  const parsed = ApprovedHedge.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid hedge", issues: parsed.error.issues }, { status: 400 });
  if (executionMode() === "live" && !GeminiClient.fromEnv().hasCredentials) {
    return NextResponse.json({ error: "Connect your Gemini account before placing hedges." }, { status: 409 });
  }
  try {
    const result = await executeHedge(getVenue(), parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
