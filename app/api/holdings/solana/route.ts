import { NextResponse, type NextRequest } from "next/server";
import { getSolanaHoldings } from "@/lib/holdings/solana";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  try {
    return NextResponse.json({ holdings: await getSolanaHoldings(address) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
