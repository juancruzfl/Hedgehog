import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { aiErrorMessage, getAI } from "@/lib/ai";
import { analyzeRisk } from "@/lib/business/analyze";
import { fallbackAnalyze } from "@/lib/business/fallback";
import { getVenue } from "@/lib/venues";

const Body = z.object({ text: z.string().trim().min(10).max(2000) });

// POST { text } -> { profile, followUps, analysis, fallback? }.
// Uses the AI provider; if it's unavailable, falls back to Hedgehog's basic matcher
// for the common cases (game-day promos, fuel and metal costs) and says so.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell us a bit more about the risk (at least a sentence)." }, { status: 400 });
  const text = parsed.data.text;
  const venue = getVenue();

  let aiError: string;
  try {
    const ai = getAI();
    const { profile, followUps } = await ai.parseRisk(text, new Date());
    const analysis = await analyzeRisk(profile, { venue, ai });
    return NextResponse.json({ profile, followUps, analysis });
  } catch (e) {
    aiError = aiErrorMessage(e);
  }

  try {
    const fb = await fallbackAnalyze(text, venue);
    if (fb) return NextResponse.json({ ...fb, fallback: true });
  } catch {
    // fall through to the AI error below
  }
  console.error("[analyze] AI unavailable:", aiError);
  return NextResponse.json(
    {
      error:
        "Our AI assistant is unavailable right now, and Hedgehog's basic matcher can't handle this one. It covers game-day promos and fuel or metal costs. Try one of the examples.",
    },
    { status: 503 },
  );
}
