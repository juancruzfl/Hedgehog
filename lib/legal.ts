// Details used across the legal pages. Fill these in before a public launch;
// until then the pages show a clearly marked placeholder.

export const LEGAL = {
  /** Legal name of whoever operates the site (a person or a company). */
  operator: "Juan Cruz",
  /** Address for privacy requests and legal notices. */
  contactEmail: "cruzjuan298@gmail.com",
  /** US state whose laws govern the Terms of Use, e.g. "New York". */
  governingState: "New York",
  /** When these documents took effect. */
  effective: "November 17, 2026",
};

export const placeholder = (value: string, what: string) => value || `[${what} — to be added]`;

export const LEGAL_PAGES = [
  { href: "/legal/privacy", title: "Privacy Policy" },
  { href: "/legal/terms", title: "Terms of Use" },
  { href: "/legal/risk", title: "Risk Disclosure" },
  { href: "/legal/cookies", title: "Cookies & Storage" },
] as const;

/** Keys Hedgehog stores in your browser (listed on the Cookies & Storage page). */
export const STORAGE_KEYS = {
  holdings: "hedgehog.holdings.v1",
  notice: "hedgehog.storage-notice.v1",
  /** sessionStorage: the nav animation already played this visit. */
  introSeen: "hedgehog.intro-seen.v1",
} as const;
