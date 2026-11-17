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

/** JSON.parse, but large integer ids (order ids) are kept as exact strings. */
export function parseKeepingIds(text: string): unknown {
  try {
    return JSON.parse(text.replace(/"(orderId|id)"\s*:\s*(\d{16,})/g, '"$1":"$2"'));
  } catch {
    return null;
  }
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
  /** Private calls are serialized: Gemini rejects a nonce that doesn't increase. */
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private cfg: GeminiClientConfig) {}

  /** Shared instance: one nonce sequence per API key across all server routes. */
  static fromEnv(): GeminiClient {
    const g = globalThis as { __geminiClient?: GeminiClient };
    g.__geminiClient ??= new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY,
      apiSecret: process.env.GEMINI_API_SECRET,
      tradingEnv: (process.env.GEMINI_TRADING_ENV as Env) ?? "sandbox",
      marketDataEnv: (process.env.GEMINI_MARKET_DATA_ENV as Env) ?? "production",
      nonceMode: (process.env.GEMINI_NONCE_MODE as "time" | "incremental") ?? "time",
    });
    return g.__geminiClient;
  }

  get hasCredentials(): boolean {
    return Boolean(this.cfg.apiKey && this.cfg.apiSecret);
  }

  get tradingEnv(): Env {
    return this.cfg.tradingEnv ?? "sandbox";
  }

  async publicGet<T>(
    path: string,
    params: Record<string, string | string[] | number | undefined> = {},
    env: Env = this.cfg.marketDataEnv ?? "production",
  ): Promise<T> {
    const url = new URL(path, BASES[env]);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
    }
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new GeminiApiError(res.status, body, path);
    return body as T;
  }

  privatePost<T>(
    path: string,
    fields: Record<string, unknown> = {},
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    return this.enqueue(() => this.signed<T>("POST", path, fields, query));
  }

  /** Authenticated GET (e.g. /v1/prediction-markets/terms/status), same signing scheme. */
  privateGet<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    return this.enqueue(() => this.signed<T>("GET", path, {}, query));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.retryOnNonce(fn));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async signed<T>(
    method: "GET" | "POST",
    path: string,
    fields: Record<string, unknown>,
    query: Record<string, string | number | undefined>,
  ): Promise<T> {
    if (!this.hasCredentials) {
      throw new Error("Gemini API key/secret not configured (GEMINI_API_KEY, GEMINI_API_SECRET)");
    }
    const payload = { request: path, nonce: this.nextNonce(), ...fields };
    // Order ids exceed JS's safe integer range, so callers pass them as strings and
    // they are written back into the JSON as bare numbers, digit for digit.
    const json = JSON.stringify(payload).replace(/"(orderId)":"(\d+)"/g, '"$1":$2');
    const b64 = Buffer.from(json).toString("base64");
    const signature = createHmac("sha384", this.cfg.apiSecret!).update(b64).digest("hex");

    const url = new URL(path, BASES[this.cfg.tradingEnv ?? "sandbox"]);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));

    const res = await fetch(url, {
      method,
      headers: {
        ...(method === "POST" ? { "Content-Type": "text/plain", "Content-Length": "0" } : {}),
        "X-GEMINI-APIKEY": this.cfg.apiKey!,
        "X-GEMINI-PAYLOAD": b64,
        "X-GEMINI-SIGNATURE": signature,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    const body = parseKeepingIds(await res.text());
    if (!res.ok) throw new GeminiApiError(res.status, body, path);
    return body as T;
  }

  /**
   * Another process using the same key (dev server, demo:check) may have used a nonce
   * at or above ours. Gemini rejects that with InvalidNonce before doing anything, so
   * it is safe to retry with a higher nonce a couple of times.
   */
  private async retryOnNonce<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        const reason = e instanceof GeminiApiError ? (e.body as { reason?: string } | null)?.reason : undefined;
        if (reason !== "InvalidNonce" || i >= attempts - 1) throw e;
        await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  private nextNonce(): number {
    const candidate = this.cfg.nonceMode === "incremental" ? Date.now() : Math.floor(Date.now() / 1000);
    // Must strictly increase in both modes. In time mode, bumping by 1s keeps us well
    // inside Gemini's +/-30s window for normal bursts of calls.
    const nonce = Math.max(candidate, this.lastNonce + 1);
    this.lastNonce = nonce;
    return nonce; // prediction-markets routes require a JSON number
  }
}
