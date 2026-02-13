import { COINGECKO_API_KEY } from "../config/env";

interface PriceResponse {
  solana: {
    usd: number;
  };
}

interface CoinGeckoTokenPriceResponse {
  [mint: string]: {
    usd?: number;
  };
}

export class PriceService {
  private static instance: PriceService;
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  async getSolPriceInUsd(): Promise<number> {
    const cacheKey = "solana:usd";
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.price;
    }

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (COINGECKO_API_KEY) {
        headers["x-cg-api-key"] = COINGECKO_API_KEY;
      }

      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        {
          method: "GET",
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: PriceResponse = await response.json();
      const price = data.solana?.usd || 0;

      this.cache.set(cacheKey, {
        price,
        timestamp: Date.now(),
      });

      return price;
    } catch (error) {
      console.error("Error fetching SOL price:", error);
      // Return cached price if available, otherwise return a default value
      return cached?.price || 100;
    }
  }

  async getTokenPricesInUsd(
    mints: string[],
  ): Promise<Record<string, number>> {
    const uniqueMints = Array.from(
      new Set(mints.map((mint) => mint.trim()).filter(Boolean)),
    );
    if (uniqueMints.length === 0) {
      return {};
    }

    const result: Record<string, number> = {};
    const uncached: string[] = [];

    uniqueMints.forEach((mint) => {
      const cacheKey = `mint:${mint}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        result[mint] = cached.price;
      } else {
        uncached.push(mint);
      }
    });

    if (uncached.length === 0) {
      return result;
    }

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < uncached.length; i += chunkSize) {
      chunks.push(uncached.slice(i, i + chunkSize));
    }

    try {
      const responses = await Promise.all(
        chunks.map(async (chunk) => {
          const ids = encodeURIComponent(chunk.join(","));
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${ids}&vs_currencies=usd`,
            {
              method: "GET",
              headers: COINGECKO_API_KEY
                ? { "x-cg-api-key": COINGECKO_API_KEY }
                : undefined,
            },
          );

          if (!response.ok) {
            throw new Error(`CoinGecko token price error: ${response.status}`);
          }

          const data: CoinGeckoTokenPriceResponse = await response.json();
          return data;
        }),
      );

      responses.forEach((payload) => {
        Object.entries(payload ?? {}).forEach(([mint, entry]) => {
          const price = entry?.usd;
          if (typeof price === "number" && Number.isFinite(price)) {
            result[mint] = price;
            this.cache.set(`mint:${mint}`, {
              price,
              timestamp: Date.now(),
            });
          }
        });
      });
    } catch (error) {
      console.warn("Error fetching token prices:", error);
    }

    return result;
  }
}

export const priceService = PriceService.getInstance();
