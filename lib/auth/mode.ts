import { GeminiClient } from "@/lib/venues/gemini/client";
import { oauthConfig } from "./gemini-oauth";

// How people connect Gemini:
//   oauth        (default when configured): each user signs in with their own Gemini account.
//   sandbox-key  (GEMINI_SIGN_IN=sandbox-key): while Hedgehog's OAuth app awaits Gemini's
//                approval, "Connect" signs people in to Hedgehog's own Gemini *sandbox*
//                account (the server's API key). Shared and test-only: refused unless the
//                key trades in the sandbox, so it can never hand out a production account.
//   off          nothing configured.

export type SignInMode = "oauth" | "sandbox-key" | "off";

let warned = false;
export function signInMode(): SignInMode {
  if (process.env.GEMINI_SIGN_IN === "sandbox-key") {
    const server = GeminiClient.fromEnv();
    if (server.hasCredentials && server.tradingEnv === "sandbox") return "sandbox-key";
    if (!warned) console.error("[auth] GEMINI_SIGN_IN=sandbox-key needs GEMINI_API_KEY/SECRET for the sandbox (GEMINI_TRADING_ENV=sandbox); sign-in is off.");
    warned = true;
    return "off";
  }
  return oauthConfig() ? "oauth" : "off";
}
