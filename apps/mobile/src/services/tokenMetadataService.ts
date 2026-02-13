import { cacheUtils } from "../utils/cache";
import { HELIUS_API_BASE, HELIUS_API_KEY } from "../config/env";

export interface TokenMetadata {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
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
      const baseUrl = HELIUS_API_BASE.replace(/\/$/, "");
      const tokens: TokenMetadata[] = [];
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
            decimals?: number;
            logoUri?: string;
          }>;
          pagination?: {
            hasMore?: boolean;
          };
        };

        const pageTokens = (payload.balances ?? []).map((entry) => ({
          address: entry.mint,
          symbol: entry.symbol,
          name: entry.name,
          decimals: entry.decimals,
          logoURI: entry.logoUri,
        }));

        tokens.push(...pageTokens);
        hasMore = Boolean(payload.pagination?.hasMore);
        page += 1;
      }

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
