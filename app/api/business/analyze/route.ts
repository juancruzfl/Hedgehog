import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { aiErrorMessage, getAI } from "@/lib/ai";
import { analyzeRisk } from "@/lib/business/analyze";
import { getVenue } from "@/lib/venues";

const Body = z.object({ text: z.string().trim().min(10).max(2000) });

// POST { text } -> { profile, followUps, analysis }. This is the only step that calls the AI.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell us a bit more about the risk (at least a sentence)." }, { status: 400 });

  let ai;
  try {
    ai = getAI();
  } catch (e) {
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 503 });
  }

  try {
    const { profile, followUps } = await ai.parseRisk(parsed.data.text, new Date());
    const analysis = await analyzeRisk(profile, { venue: getVenue(), ai });
    return NextResponse.json({ profile, followUps, analysis });
  } catch (e) {
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 502 });
  }
}
