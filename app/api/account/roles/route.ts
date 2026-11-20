import { NextResponse, type NextRequest } from "next/server";
import { RolesInput } from "@/lib/auth/roles";
import { getSession, setSessionRoles } from "@/lib/auth/session";

// POST { roles: ["crypto" | "business", ...] }: what the signed-in user came to hedge.
export async function POST(req: NextRequest) {
  const s = await getSession(req);
  if (!s) return NextResponse.json({ error: "Connect your Gemini account first." }, { status: 401 });
  const parsed = RolesInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pick at least one." }, { status: 400 });
  setSessionRoles(s.idHash, parsed.data.roles);
  return NextResponse.json({ roles: parsed.data.roles });
}
