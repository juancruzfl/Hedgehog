import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { parseRoles, RolesInput } from "./roles";
import { SESSION_COOKIE, createSession, getSession, setSessionRoles } from "./session";

describe("roles", () => {
  it("needs at least one, allows both, and drops repeats", () => {
    expect(RolesInput.safeParse({ roles: [] }).success).toBe(false);
    expect(RolesInput.safeParse({ roles: ["admin"] }).success).toBe(false);
    expect(RolesInput.parse({ roles: ["business", "crypto", "business"] }).roles).toEqual(["crypto", "business"]);
  });

  it("reads stored roles, ignoring anything unknown", () => {
    expect(parseRoles("")).toEqual([]);
    expect(parseRoles("business,admin")).toEqual(["business"]);
  });

  it("starts a new sign-in with no roles, then remembers the pick on the session", async () => {
    const id = createSession("sandbox", { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 3600_000, scope: "balances:read" }, "Test");
    const req = { cookies: { get: (n: string) => (n === SESSION_COOKIE ? { value: id } : undefined) } } as unknown as NextRequest;
    const s = (await getSession(req))!;
    expect(s.roles).toEqual([]);
    setSessionRoles(s.idHash, ["crypto", "business"]);
    expect((await getSession(req))!.roles).toEqual(["crypto", "business"]);
  });
});
