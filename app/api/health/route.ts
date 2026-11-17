import { NextResponse } from "next/server";

// Lightweight health check for the host (no external calls).
export function GET() {
  return NextResponse.json({ ok: true });
}
