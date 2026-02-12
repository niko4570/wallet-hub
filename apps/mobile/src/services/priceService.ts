import { COINGECKO_API_KEY } from "../config/env";

interface PriceResponse {
  solana: {
    usd: number;
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
        'Content-Type': 'application/json',
      };

      if (COINGECKO_API_KEY) {
        headers['x-cg-api-key'] = COINGECKO_API_KEY;
      }

      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        {
          method: 'GET',
          headers,
        }
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
}

export const priceService = PriceService.getInstance();
