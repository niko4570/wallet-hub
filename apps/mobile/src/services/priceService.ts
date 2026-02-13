import { cacheUtils } from "../utils/cache";

declare const process: { env?: Record<string, string | undefined> };

const JUPITER_API_KEY = process.env?.EXPO_PUBLIC_JUPITER_API_KEY || "";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_ENDPOINT = "https://api.jup.ag/price/v3";
const PRICE_CHUNK_SIZE = 50;
const DEFAULT_SOL_FALLBACK = 100;

type JupiterPriceEntry = {
  price?: number | string;
};

type JupiterPriceEnvelope = {
  data?: Record<string, JupiterPriceEntry>;
};

export class PriceService {
  private static instance: PriceService;
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  private inFlightSol?: Promise<number>;
  private hasWarnedAboutKey = false;

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (JUPITER_API_KEY) {
      headers["x-api-key"] = JUPITER_API_KEY;
    } else if (!this.hasWarnedAboutKey) {
      this.hasWarnedAboutKey = true;
      console.warn(
        "[priceService] EXPO_PUBLIC_JUPITER_API_KEY not set; falling back to cached prices.",
      );
    }
    return headers;
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

    const headers = this.buildHeaders();
    if (!JUPITER_API_KEY) {
      throw new Error(
        "Jupiter API key missing. Set EXPO_PUBLIC_JUPITER_API_KEY to fetch live prices.",
      );
    }

    const params = new URLSearchParams({
      ids: mints.join(","),
    });
    const response = await fetch(`${PRICE_ENDPOINT}?${params.toString()}`, {
      headers,
    });
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Unauthorized response from Jupiter price API. Check EXPO_PUBLIC_JUPITER_API_KEY."
          : `Jupiter price API error: ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();
    const normalized: Record<string, number> = {};

    mints.forEach((mint) => {
      const price = data[mint]?.usdPrice;
      if (typeof price === "number" && Number.isFinite(price)) {
        normalized[mint] = price;
      }
    });

    return normalized;
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
}

export const priceService = PriceService.getInstance();
