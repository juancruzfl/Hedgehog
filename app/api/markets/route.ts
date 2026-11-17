import { NextResponse, type NextRequest } from "next/server";
import { getVenue } from "@/lib/venues";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    const markets = await getVenue(p.get("venue") ?? "gemini").listMarkets({
      category: p.getAll("category").filter(Boolean),
      search: p.get("search") ?? undefined,
      limit: Number(p.get("limit") ?? 50),
    });
    return NextResponse.json({ markets });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
