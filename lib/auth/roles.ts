import { z } from "zod";

// What a signed-in user came to hedge. Picked right after connecting Gemini; decides which
// parts of the app show in the nav. At least one, possibly both.

export const ROLES = ["crypto", "business"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { title: string; body: string; href: string; nav: string }> = {
  crypto: {
    title: "Crypto trader",
    body: "See how likely a drop in your coins is, and cushion it before it happens.",
    href: "/crypto",
    nav: "Crypto",
  },
  business: {
    title: "Small business owner",
    body: "Turn a risky promo, a fuel bill or a weather worry into a known cost.",
    href: "/business",
    nav: "Business",
  },
};

/** One or both roles, no repeats. */
export const RolesInput = z.object({
  roles: z
    .array(z.enum(ROLES))
    .min(1, "Pick at least one.")
    .transform((r) => ROLES.filter((x) => r.includes(x))),
});

/** Roles as stored on a session ("crypto,business"); unknown values are dropped. */
export const parseRoles = (stored: string | null | undefined): Role[] =>
  ROLES.filter((r) => (stored ?? "").split(",").includes(r));
