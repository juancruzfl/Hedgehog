import { NextResponse, type NextRequest } from "next/server";
import { getBitcoinHoldings } from "@/lib/holdings/bitcoin";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  try {
    return NextResponse.json({ holdings: await getBitcoinHoldings(address) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
