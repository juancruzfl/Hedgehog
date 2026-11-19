import type { Contract, RiskProfile } from "@/lib/types";

export type MatchQuality = "exact" | "proxy" | "none";

export interface MarketMatch {
  symbol: string; // always one of the candidate symbols passed in
  outcome: "yes" | "no"; // the side that pays out when the user's risk happens
  quality: MatchQuality;
  rationale: string;
  /** Differences between the contract's resolution rules and the user's actual risk. */
  ruleMismatches: string[];
}

export type ParsedRisk =
  | {
      isRisk: true;
      profile: RiskProfile;
      /** Questions to ask when the description is missing something important. */
      followUps: string[];
    }
  | { isRisk: false; profile: null; followUps: [] };

export interface SearchPlan {
  categories: string[];
  terms: string[];
}

/**
 * The AI layer interprets; it never does money math or places orders.
 * Explanations are templated in code. Swapping providers = new implementation of this.
 */
export interface AIProvider {
  readonly name: string;
  /** Plain-English risk description -> structured RiskProfile (business front door). */
  parseRisk(text: string, now: Date): Promise<ParsedRisk>;
  /** Categories and search terms to find candidate markets for a profile. */
  searchPlan(profile: RiskProfile): Promise<SearchPlan>;
  /** Rank candidates; results only ever reference symbols from `candidates`. */
  rankMarkets(profile: RiskProfile, candidates: Contract[]): Promise<MarketMatch[]>;
}
