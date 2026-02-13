import { cacheUtils } from "../utils/cache";
import { HELIUS_API_BASE, HELIUS_API_KEY } from "../config/env";

export interface TokenMetadata {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
}

export interface HeliusTokenBalance {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  decimals: number;
  usdValue?: number;
  pricePerToken?: number;
  logoUri?: string;
}

const HELIUS_WALLET_BALANCES_PATH = "/v1/wallet";
const HELIUS_PAGE_LIMIT = 100;

const buildMetadataMap = (
  tokens: TokenMetadata[],
): Record<string, TokenMetadata> => {
  const map: Record<string, TokenMetadata> = {};
  tokens.forEach((token) => {
    if (token.address) {
      map[token.address] = token;
    }
  });
  return map;
};

export const tokenMetadataService = {
  async getTokenBalancesForWallet(
    walletAddress: string,
  ): Promise<HeliusTokenBalance[]> {
    if (!HELIUS_API_KEY) {
      console.warn("Helius API key missing; cannot fetch token balances.");
      return [];
    }

    try {
      const baseUrl = HELIUS_API_BASE.replace(/\/$/, "");
      const balances: HeliusTokenBalance[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url =
          `${baseUrl}${HELIUS_WALLET_BALANCES_PATH}/${walletAddress}/balances` +
          `?api-key=${encodeURIComponent(HELIUS_API_KEY)}` +
          `&page=${page}&limit=${HELIUS_PAGE_LIMIT}` +
          `&showZeroBalance=false&showNative=true&showNfts=false`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "X-Api-Key": HELIUS_API_KEY,
          },
        });
        if (!response.ok) {
          throw new Error(`Helius balances error: ${response.status}`);
        }

        const payload = (await response.json()) as {
          balances?: Array<{
            mint: string;
            symbol?: string;
            name?: string;
            balance?: number;
            decimals?: number;
            pricePerToken?: number;
            usdValue?: number;
            logoUri?: string;
          }>;
          pagination?: {
            hasMore?: boolean;
          };
        };

        const pageBalances = (payload.balances ?? []).map((entry) => ({
          mint: entry.mint,
          symbol: entry.symbol,
          name: entry.name,
          balance: entry.balance ?? 0,
          decimals: entry.decimals ?? 0,
          pricePerToken: entry.pricePerToken,
          usdValue: entry.usdValue,
          logoUri: entry.logoUri,
        }));

        balances.push(...pageBalances);
        hasMore = Boolean(payload.pagination?.hasMore);
        page += 1;
      }

      return balances;
    } catch (error) {
      console.warn("Failed to fetch token balances from Helius", error);
      return [];
    }
  },

  async getMetadataMapForWallet(
    walletAddress: string,
    mints: string[],
  ): Promise<Record<string, TokenMetadata>> {
    const cached = await cacheUtils.getCachedTokenMetadata();
    if (cached && typeof cached === "object") {
      const map = cached as Record<string, TokenMetadata>;
      return mints.reduce((acc, mint) => {
        if (map[mint]) {
          acc[mint] = map[mint];
        }
        return acc;
      }, {} as Record<string, TokenMetadata>);
    }

    if (!HELIUS_API_KEY) {
      console.warn("Helius API key missing; cannot fetch token metadata.");
      return {};
    }

    try {
      const balances = await this.getTokenBalancesForWallet(walletAddress);
      const tokens = balances.map((entry) => ({
        address: entry.mint,
        symbol: entry.symbol,
        name: entry.name,
        decimals: entry.decimals,
        logoURI: entry.logoUri,
      }));

      const map = buildMetadataMap(tokens);
      await cacheUtils.setCachedTokenMetadata(map);

      return mints.reduce((acc, mint) => {
        if (map[mint]) {
          acc[mint] = map[mint];
        }
        return acc;
      }, {} as Record<string, TokenMetadata>);
    } catch (error) {
      console.warn("Failed to fetch token metadata from Helius", error);
      return {};
    }
  },
};
