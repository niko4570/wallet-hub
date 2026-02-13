import { cacheUtils } from "../utils/cache";

export interface TokenMetadata {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
}

const TOKEN_LIST_URL = "https://token.jup.ag/all";

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
  async getMetadataMap(
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

    try {
      const response = await fetch(TOKEN_LIST_URL, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Token list fetch failed: ${response.status}`);
      }
      const payload = (await response.json()) as TokenMetadata[];
      const map = buildMetadataMap(payload);
      await cacheUtils.setCachedTokenMetadata(map);

      return mints.reduce((acc, mint) => {
        if (map[mint]) {
          acc[mint] = map[mint];
        }
        return acc;
      }, {} as Record<string, TokenMetadata>);
    } catch (error) {
      console.warn("Failed to fetch token metadata", error);
      return {};
    }
  },
};
