import type { NextRequest } from "next/server";
import { z } from "zod";
import { aiErrorMessage, aiOff, getAI } from "@/lib/ai";
import { analyzeRisk, type StepEvent } from "@/lib/business/analyze";
import { fallbackAnalyze } from "@/lib/business/fallback";
import { shortDate, usd } from "@/lib/format";
import { getVenue } from "@/lib/venues";
import { snapshotMarkets } from "@/lib/odds/collect";
import { watchMarkets } from "@/lib/odds/store";

/**
 * Game markets aren't in the regularly collected categories, so start recording the ones
 * we just showed (and take a first reading now) so their cards can show odds over time.
 */
function recordOdds(analysis: { type: string; matches?: { contract: { marketId: string } }[] }) {
  if (analysis.type !== "event" || !analysis.matches) return;
  const ids = [...new Set(analysis.matches.map((m) => m.contract.marketId))];
  try {
    watchMarkets(ids);
    void snapshotMarkets(ids).catch(() => {});
  } catch {
    // History is a nice-to-have; never fail the analysis over it.
  }
}

const Body = z.object({ text: z.string().trim().min(10).max(2000) });

/**
 * POST { text } -> a stream of newline-delimited JSON events so the page can show the
 * engine's real working steps as they happen:
 *   {"type":"step","step":"understand","status":"active","detail":"..."}
 *   ...
 *   {"type":"result","profile":...,"followUps":[...],"analysis":...,"fallback"?:true}
 *   or {"type":"error","error":"..."}
 * Uses the AI provider; if it's unavailable, falls back to Hedgehog's basic matcher.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const step = (e: StepEvent) => send({ type: "step", ...e });

      if (!parsed.success) {
        send({ type: "error", error: "Tell us a bit more about the risk (at least a sentence)." });
        return controller.close();
      }
      const text = parsed.data.text;
      const venue = getVenue();

      let aiError: string;
      try {
        const ai = getAI();
        step({ step: "understand", status: "active", detail: "Reading your description" });
        const { profile, followUps } = await ai.parseRisk(text, new Date());
        step({
          step: "understand",
          status: "done",
          detail: `${profile.condition}${profile.exposureUsd.expected ? ` · costs you about ${usd(profile.exposureUsd.expected, 0)}` : ""} · by ${shortDate(profile.window.end)}`,
        });
        const analysis = await analyzeRisk(profile, { venue, ai, onStep: step });
        recordOdds(analysis);
        send({ type: "result", profile, followUps, analysis });
        return controller.close();
      } catch (e) {
        aiError = aiErrorMessage(e);
      }

      // AI unavailable: basic matcher for the common cases.
      const off = aiOff();
      step({ step: "understand", status: "active", detail: off ? "AI turned off for testing · using Hedgehog's basic matcher" : "AI assistant unavailable · using Hedgehog's basic matcher" });
      try {
        const fb = await fallbackAnalyze(text, venue, new Date(), step);
        if (fb) {
          recordOdds(fb.analysis);
          send({ type: "result", ...fb, fallback: off ? "off" : true });
          return controller.close();
        }
      } catch {
        // fall through
      }
      console.error("[analyze] AI unavailable:", aiError);
      step({ step: "understand", status: "error", detail: "Couldn't read this one without the AI assistant" });
      send({
        type: "error",
        error: off
          ? "AI is turned off for testing (AI_MODE=off), and the basic matcher can't handle this one. It covers game-day promos and fuel or metal costs. Try one of those examples, or remove AI_MODE=off."
          : "Our AI assistant is unavailable right now, and Hedgehog's basic matcher can't handle this one. It covers game-day promos and fuel or metal costs. Try one of the examples.",
      });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
