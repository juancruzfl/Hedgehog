import { createHmac } from "node:crypto";

// Server-only Gemini REST client.
// - Public market data (no key) comes from MARKET DATA base (production by default,
//   so the demo shows real markets even when trading in the sandbox).
// - Private routes use HMAC-SHA384 signing: the JSON payload is base64-encoded into
//   X-GEMINI-PAYLOAD with an empty body. See developer.gemini.com/authentication/api-key

const BASES = {
  production: "https://api.gemini.com",
  sandbox: "https://api.sandbox.gemini.com",
} as const;
type Env = keyof typeof BASES;

export interface GeminiClientConfig {
  apiKey?: string;
  apiSecret?: string;
  tradingEnv?: Env;
  marketDataEnv?: Env;
  /** "time" = unix seconds (Gemini's recommended mode); "incremental" = ms counter. */
  nonceMode?: "time" | "incremental";
}

export class GeminiApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    path: string,
  ) {
    super(`Gemini ${path} failed with ${status}: ${JSON.stringify(body)}`);
  }
}

export class GeminiClient {
  private lastNonce = 0;
  constructor(private cfg: GeminiClientConfig) {}

  static fromEnv(): GeminiClient {
    return new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY,
      apiSecret: process.env.GEMINI_API_SECRET,
      tradingEnv: (process.env.GEMINI_TRADING_ENV as Env) ?? "sandbox",
      marketDataEnv: (process.env.GEMINI_MARKET_DATA_ENV as Env) ?? "production",
      nonceMode: (process.env.GEMINI_NONCE_MODE as "time" | "incremental") ?? "time",
    });
  }

  get hasCredentials(): boolean {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret);
  }

  async publicGet<T>(path: string, params: Record<string, string | string[] | number | undefined> = {}): Promise<T> {
    const url = new URL(path, BASES[this.cfg.marketDataEnv ?? "production"]);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
    }
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new GeminiApiError(res.status, body, path);
    return body as T;
  }

  async privatePost<T>(
    path: string,
    fields: Record<string, unknown> = {},
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    if (!this.hasCredentials) {
      throw new Error("Gemini API key/secret not configured (GEMINI_API_KEY, GEMINI_API_SECRET)");
    }
    const payload = { request: path, nonce: this.nextNonce(), ...fields };
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = createHmac("sha384", this.cfg.apiSecret!).update(b64).digest("hex");

    const url = new URL(path, BASES[this.cfg.tradingEnv ?? "sandbox"]);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "0",
        "X-GEMINI-APIKEY": this.cfg.apiKey!,
        "X-GEMINI-PAYLOAD": b64,
        "X-GEMINI-SIGNATURE": signature,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new GeminiApiError(res.status, body, path);
    return body as T;
  }

  private nextNonce(): string {
    const candidate = this.cfg.nonceMode === "incremental" ? Date.now() : Math.floor(Date.now() / 1000);
    // Incremental mode must strictly increase; time mode just needs to be within ±30s.
    const nonce = this.cfg.nonceMode === "incremental" ? Math.max(candidate, this.lastNonce + 1) : candidate;
    this.lastNonce = nonce;
    return String(nonce);
  }
}
