import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { headline } from "@/app/lookback/copy";
import { HEDGEHOG_COAT, HEDGEHOG_FRONT } from "@/components/Logo";
import { usd } from "@/lib/format";
import { lookback, parseLookbackParams } from "@/lib/lookback/data";

// GET ?m=&c=&cost=&at=&promo= → a 1200×630 PNG of one look-back result: the link preview
// for shared results, and an image to drop into outreach emails.

export const runtime = "nodejs";

// Light theme tokens (globals.css), as plain colors for the image renderer.
const T = { bg: "#f2f3f5", surface: "#ffffff", s2: "#eceef1", text: "#15181d", text2: "#4f5663", text3: "#626a78", accent: "#0e7490", good: "#137a47", border: "#dfe2e7" };

const signed = (n: number | null) => (n === null ? "—" : n === 0 ? usd(0) : `${n > 0 ? "+" : "−"}${usd(Math.abs(n))}`);

export async function GET(req: NextRequest) {
  const q = parseLookbackParams(Object.fromEntries(req.nextUrl.searchParams));
  const r = q ? await lookback(q).catch(() => null) : null;
  if (!r || "error" in r) return new Response("Not found", { status: 404 });
  const h = headline(r);
  const m = r.math;

  const stat = (label: string, value: string, strong = false) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 24px", borderRadius: 18, background: strong ? "#e0eef3" : T.s2 }}>
      <div style={{ fontSize: 22, color: T.text2 }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: T.text, marginTop: 4 }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: T.bg, padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, background: T.surface, border: `2px solid ${T.border}`, borderRadius: 28, padding: "40px 48px" }}>
          <div style={{ display: "flex", fontSize: 26, color: T.text2 }}>{h.title}</div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: -1.5, color: h.tone === "good" ? T.good : T.text, marginTop: 10 }}>{h.big}</div>
          <div style={{ display: "flex", fontSize: 26, lineHeight: 1.35, color: T.text2, marginTop: 14 }}>{h.line}</div>
          <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
            {stat("Without a hedge", signed(m.without))}
            {stat("With the hedge", signed(m.withHedge), true)}
            {stat("Hedge cost", usd(m.hedgeCost))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 22, fontSize: 22, color: T.text3 }}>
          {/* The wordmark with the logo to its right, as in the nav (same shapes as components/Logo.tsx) */}
          <div style={{ display: "flex", fontWeight: 700, color: T.text, fontSize: 26 }}>hedgehog</div>
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginLeft: 10 }}>
            <path d={HEDGEHOG_COAT} fill={T.bg} stroke={T.text} strokeWidth={2.8} strokeLinejoin="round" />
            <circle cx="20.8" cy="15.4" r="4.2" fill={T.bg} stroke={T.text} strokeWidth={2.4} />
            <circle cx="43.2" cy="15.4" r="4.2" fill={T.bg} stroke={T.text} strokeWidth={2.4} />
            <path d={HEDGEHOG_FRONT} fill={T.bg} stroke={T.text} strokeWidth={2.8} />
            <circle cx="25.6" cy="24.6" r="3.2" fill={T.text} />
            <circle cx="38.4" cy="24.6" r="3.2" fill={T.text} />
            <ellipse cx="32" cy="28.6" rx="1.6" ry="1.2" fill={T.text} />
            <path d="M29.2 30.6c.7 1.4 2.8 1.4 2.8-.4 0 1.8 2.1 1.8 2.8.4" stroke={T.text} strokeWidth={2.4} strokeLinecap="round" />
            <path d="M21 40.4c-.4 3.6.9 6.4 3.5 7.1M43 40.4c.4 3.6-.9 6.4-3.5 7.1M22.6 56.6c0 2.6 1.6 4 3.8 4s3.8-1.4 3.8-3.6M41.4 56.6c0 2.6-1.6 4-3.8 4s-3.8-1.4-3.8-3.6" stroke={T.text} strokeWidth={2.4} strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", marginLeft: "auto" }}>Odds from Gemini prediction markets · recorded by Hedgehog, sealed on Solana</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": r.resolution ? "public, max-age=86400" : "public, max-age=300" } },
  );
}
