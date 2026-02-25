import { cacheUtils } from "../../utils";
import { jupiterService } from "./jupiterService";

declare const process: { env?: Record<string, string | undefined> };

const JUPITER_API_KEY = process.env?.EXPO_PUBLIC_JUPITER_API_KEY || "";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_CHUNK_SIZE = 50;
const DEFAULT_SOL_FALLBACK = 100;
const RATE_LIMIT_COOLDOWN_MS = 5 * 1000;
const UNAUTHORIZED_COOLDOWN_MS = 60 * 1000;

type PriceServiceStatus =
  | {
      state: "healthy";
      lastSuccessAt: number;
    }
  | {
      state:
        | "missing_api_key"
        | "unauthorized"
        | "rate_limited"
        | "network_error";
      lastError: string;
      occurredAt: number;
    };

export class PriceService {
  private static instance: PriceService;
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheDuration = 30 * 1000; // 30 seconds cache
  private inFlightSol?: Promise<number>;
  private hasWarnedAboutKey = false;
  private status: PriceServiceStatus = JUPITER_API_KEY
    ? {
        state: "healthy",
        lastSuccessAt: 0,
      }
    : {
        state: "missing_api_key",
        lastError:
          "EXPO_PUBLIC_JUPITER_API_KEY not set; falling back to cached prices.",
        occurredAt: Date.now(),
      };
  private rateLimitedUntil = 0;
  private unauthorizedUntil = 0;

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  private ensureApiKey(): boolean {
    if (JUPITER_API_KEY) {
      return true;
    }
    if (!this.hasWarnedAboutKey) {
      this.hasWarnedAboutKey = true;
      console.warn(
        "[priceService] EXPO_PUBLIC_JUPITER_API_KEY not set; falling back to cached prices.",
      );
    }
    this.status = {
      state: "missing_api_key",
      lastError:
        "EXPO_PUBLIC_JUPITER_API_KEY not set; falling back to cached prices.",
      occurredAt: Date.now(),
    };
    return false;
  }

  private updateStatus(next: PriceServiceStatus) {
    this.status = next;
  }

  private classifyError(
    error: unknown,
  ): Exclude<PriceServiceStatus["state"], "healthy" | "missing_api_key"> {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    const normalized = message.toLowerCase();
    if (message.includes("401") || normalized.includes("unauthorized")) {
      return "unauthorized";
    }
    if (message.includes("429") || normalized.includes("rate limit")) {
      return "rate_limited";
    }
    return "network_error";
  }

  getStatus(): PriceServiceStatus {
    return this.status;
  }

  hasApiKey(): boolean {
    return Boolean(JUPITER_API_KEY);
  }

  private parsePrice(value?: number | string): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private async fetchPrices(mints: string[]): Promise<Record<string, number>> {
    if (mints.length === 0) {
      return {};
    }

    if (!this.ensureApiKey()) {
      return {};
    }

    if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
      this.updateStatus({
        state: "rate_limited",
        lastError: "Jupiter price API rate limited. Cooling down.",
        occurredAt: Date.now(),
      });
      return {};
    }

    if (this.unauthorizedUntil && Date.now() < this.unauthorizedUntil) {
      this.updateStatus({
        state: "unauthorized",
        lastError: "Jupiter price API unauthorized. Waiting before retry.",
        occurredAt: Date.now(),
      });
      return {};
    }

    try {
      const response = await jupiterService.requestJson<
        Record<string, { usdPrice: number }>
      >("/price/v3", {
        params: {
          ids: mints.join(","),
        },
      });

      const normalized: Record<string, number> = {};

      mints.forEach((mint) => {
        const entry = response?.[mint];
        if (entry && typeof entry.usdPrice === "number") {
          normalized[mint] = entry.usdPrice;
        }
      });

      this.updateStatus({
        state: "healthy",
        lastSuccessAt: Date.now(),
      });
      this.rateLimitedUntil = 0;
      this.unauthorizedUntil = 0;
      return normalized;
    } catch (error) {
      const classification = this.classifyError(error);
      if (classification === "rate_limited") {
        this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      } else if (classification === "unauthorized") {
        this.unauthorizedUntil = Date.now() + UNAUTHORIZED_COOLDOWN_MS;
      }
      this.updateStatus({
        state: classification,
        lastError:
          error instanceof Error
            ? error.message
            : "Jupiter price API request failed",
        occurredAt: Date.now(),
      });
      throw error;
    }
  }

  async getSolPriceInUsd(): Promise<number> {
    const cacheKey = "solana:usd";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.price;
    }

    const cachedPersisted = await cacheUtils.getCachedPrice(cacheKey);
    if (cachedPersisted !== null) {
      this.cache.set(cacheKey, {
        price: cachedPersisted,
        timestamp: Date.now(),
      });
      return cachedPersisted;
    }

    if (this.inFlightSol) {
      return this.inFlightSol;
    }

    this.inFlightSol = (async () => {
      const prices = await this.fetchPrices([WRAPPED_SOL_MINT]);
      const price = prices[WRAPPED_SOL_MINT];
      if (typeof price !== "number") {
        throw new Error("Wrapped SOL price missing from Jupiter response");
      }
      this.cache.set(cacheKey, {
        price,
        timestamp: Date.now(),
      });
      await cacheUtils.setCachedPrice(cacheKey, price);
      return price;
    })();

    try {
      return await this.inFlightSol;
    } catch (error) {
      console.error("Error fetching SOL price:", error);
      return cached?.price || cachedPersisted || DEFAULT_SOL_FALLBACK;
    } finally {
      this.inFlightSol = undefined;
    }
  }

  async getTokenPricesInUsd(mints: string[]): Promise<Record<string, number>> {
    const uniqueMints = Array.from(
      new Set(mints.map((mint) => mint.trim()).filter(Boolean)),
    );
    if (uniqueMints.length === 0) {
      return {};
    }

    const result: Record<string, number> = {};
    const uncached: string[] = [];

    for (const mint of uniqueMints) {
      const cacheKey = `mint:${mint}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        result[mint] = cached.price;
        continue;
      }

      const cachedPersisted = await cacheUtils.getCachedPrice(cacheKey);
      if (cachedPersisted !== null) {
        result[mint] = cachedPersisted;
        this.cache.set(cacheKey, {
          price: cachedPersisted,
          timestamp: Date.now(),
        });
        continue;
      }

      uncached.push(mint);
    }

    if (uncached.length === 0) {
      return result;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < uncached.length; i += PRICE_CHUNK_SIZE) {
      chunks.push(uncached.slice(i, i + PRICE_CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      try {
        const chunkPrices = await this.fetchPrices(chunk);
        chunk.forEach((mint) => {
          const price = chunkPrices[mint];
          if (typeof price === "number") {
            result[mint] = price;
            this.cache.set(`mint:${mint}`, {
              price,
              timestamp: Date.now(),
            });
            cacheUtils.setCachedPrice(`mint:${mint}`, price).catch(() => {});
          }
        });
      } catch (error) {
        console.warn("Error fetching chunked token prices:", error);
      }
    }

    return result;
  }

  async getTokenPricesWithStructure(
    mints: string[],
  ): Promise<Record<string, { price: number }>> {
    const prices = await this.getTokenPricesInUsd(mints);
    const formattedResult: Record<string, { price: number }> = {};
    Object.entries(prices).forEach(([mint, price]) => {
      formattedResult[mint] = { price };
    });
    return formattedResult;
  }
}

export const priceService = PriceService.getInstance();
