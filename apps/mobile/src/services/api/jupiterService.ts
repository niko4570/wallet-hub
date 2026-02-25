/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env?: Record<string, string | undefined> };

const JUPITER_API_BASE = "https://api.jup.ag";
const JUPITER_API_KEY =
  process.env?.EXPO_PUBLIC_JUPITER_API_KEY?.trim() ?? "";

const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 1000;
const MAX_RETRIES = 3;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const requestTimestamps: number[] = [];
const cache = new Map<
  string,
  {
    expiresAt: number;
    data: any;
  }
>();

interface RequestOptions {
  method?: "GET" | "POST";
  params?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, any> | string | undefined;
  cacheKey?: string;
  cacheTtlMs?: number;
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
) => {
  const normalizedEndpoint = endpoint.startsWith("http")
    ? endpoint
    : `${JUPITER_API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const url = new URL(normalizedEndpoint);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

const buildHeaders = (extra?: Record<string, string>) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }
  return headers;
};

const pruneTimestamps = () => {
  const cutoff = Date.now() - WINDOW_MS;
  while (requestTimestamps.length && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
};

const throttleRequests = async () => {
  while (true) {
    pruneTimestamps();
    if (requestTimestamps.length < MAX_REQUESTS_PER_WINDOW) {
      requestTimestamps.push(Date.now());
      return;
    }
    const waitTime =
      WINDOW_MS - (Date.now() - requestTimestamps[0]) + 5;
    await sleep(Math.max(waitTime, 50));
  }
};

const cacheKeyFor = (
  method: string,
  endpoint: string,
  params?: RequestOptions["params"],
  body?: RequestOptions["body"],
) => {
  const paramKey = params ? JSON.stringify(params) : "";
  const bodyKey =
    typeof body === "string" ? body : body ? JSON.stringify(body) : "";
  return `${method}:${endpoint}:${paramKey}:${bodyKey}`;
};

async function requestJson<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const cacheKey =
    options.cacheKey ??
    cacheKeyFor(method, endpoint, options.params, options.body);
  if (options.cacheTtlMs && options.cacheTtlMs > 0) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const url = buildUrl(endpoint, method === "GET" ? options.params : undefined);
  const headers = buildHeaders(options.headers);
  const body =
    method === "GET"
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await throttleRequests();
      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        if (RETRY_STATUS.has(response.status) && attempt < MAX_RETRIES) {
          await sleep(150 * attempt * attempt);
          continue;
        }
        const text = await response.text().catch(() => "");
        throw new Error(
          `Jupiter request failed (${response.status}): ${text}`.trim(),
        );
      }

      const data = (await response.json()) as T;
      if (options.cacheTtlMs && options.cacheTtlMs > 0) {
        cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + options.cacheTtlMs,
        });
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await sleep(100 * attempt * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Jupiter request failed");
}

export const jupiterService = {
  requestJson,
};

export default jupiterService;
