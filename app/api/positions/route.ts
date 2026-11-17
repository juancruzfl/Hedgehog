import { NextResponse } from "next/server";
import { executionMode } from "@/lib/hedges/execute";
import { paperPositions } from "@/lib/hedges/paper";
import { listHedges } from "@/lib/hedges/store";
import { GeminiClient } from "@/lib/venues/gemini/client";
import { getVenue } from "@/lib/venues";

export async function GET() {
  const mode = executionMode();
  const hedges = listHedges();
  try {
    if (mode === "paper") {
      return NextResponse.json({ mode, hedges, positions: await paperPositions(getVenue()) });
    }
    if (!GeminiClient.fromEnv().hasCredentials) return NextResponse.json({ mode, hedges, positions: [], connected: false });
    return NextResponse.json({ mode, hedges, positions: await getVenue().getPositions(), connected: true });
  } catch (e) {
    return NextResponse.json({ mode, hedges, positions: [], error: (e as Error).message });
  }
}
