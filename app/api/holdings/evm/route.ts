import { NextResponse, type NextRequest } from "next/server";
import { getEvmHoldings } from "@/lib/holdings/evm";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  try {
    return NextResponse.json({ holdings: await getEvmHoldings(address) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
