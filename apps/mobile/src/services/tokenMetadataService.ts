import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { cacheUtils } from "../utils/cache";
import { rpcService } from "./rpcService";
// Directly access the environment variable to ensure it's loaded correctly
declare const process: { env?: Record<string, string | undefined> };
const JUPITER_API_KEY = process.env?.EXPO_PUBLIC_JUPITER_API_KEY || "";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface TokenMetadata {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoURI?: string;
}

export interface TokenBalance {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  decimals: number;
  usdValue?: number;
  pricePerToken?: number;
  logoURI?: string;
}

interface JupiterToken {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  usdPrice: number;
}

type JupiterPriceResponse = Record<string, number>;

type JupiterPriceEnvelope = {
  data?: Record<string, { price?: number | string }>;
};

const WALLET_BALANCE_TTL = 30 * 1000;
const METADATA_TTL = 24 * 60 * 60 * 1000;
const JUPITER_TOKENS_API = "https://api.jup.ag/tokens/v2";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v3";

type WalletBalanceCacheEntry = {
  data: TokenBalance[];
  expiry: number;
  inFlight?: Promise<TokenBalance[]>;
};
type WalletBalanceCacheEntryStored = {
  data: TokenBalance[];
  expiry: number;
};

const walletBalanceCache = new Map<string, WalletBalanceCacheEntry>();
let metadataCache: Record<string, TokenMetadata> | null = null;
let metadataCacheLoaded = false;
let walletBalancesCacheLoaded = false;
let walletBalancesCache: Record<string, WalletBalanceCacheEntryStored> | null =
  null;

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

const getMetadataCache = async (): Promise<Record<string, TokenMetadata>> => {
  if (metadataCacheLoaded && metadataCache) {
    return metadataCache;
  }

  const cached = await cacheUtils.getCachedTokenMetadata();
  metadataCacheLoaded = true;
  if (cached && typeof cached === "object") {
    metadataCache = cached as Record<string, TokenMetadata>;
  } else {
    metadataCache = {};
  }
  return metadataCache;
};

const persistMetadataCache = async (map: Record<string, TokenMetadata>) => {
  metadataCache = map;
  await cacheUtils.setCachedTokenMetadata(map, METADATA_TTL);
};

const getWalletBalancesCache = async (): Promise<
  Record<string, WalletBalanceCacheEntryStored>
> => {
  if (walletBalancesCacheLoaded && walletBalancesCache) {
    return walletBalancesCache;
  }

  const cached = await cacheUtils.getCachedWalletBalances();
  walletBalancesCacheLoaded = true;
  if (cached && typeof cached === "object") {
    walletBalancesCache = cached as Record<
      string,
      WalletBalanceCacheEntryStored
    >;
  } else {
    walletBalancesCache = {};
  }
  return walletBalancesCache;
};

const persistWalletBalancesCache = async (
  map: Record<string, WalletBalanceCacheEntry>,
) => {
  const stored: Record<string, WalletBalanceCacheEntryStored> = {};
  Object.entries(map).forEach(([address, entry]) => {
    stored[address] = {
      data: entry.data,
      expiry: entry.expiry,
    };
  });
  walletBalancesCache = stored;
  await cacheUtils.setCachedWalletBalances(stored, WALLET_BALANCE_TTL);
};

// Validates mint address using base58 regex
const isValidMintAddress = (mint: string): boolean => {
  const base58Regex =
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}$/;
  return base58Regex.test(mint);
};

// Processes mints in batches to avoid API limits
const processInBatches = async <T>(
  items: string[],
  batchSize: number,
  processor: (batch: string[]) => Promise<T>,
): Promise<T[]> => {
  const batches: string[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results: T[] = [];
  for (const batch of batches) {
    const result = await processor(batch);
    results.push(result);
  }

  return results;
};

// Get actual token holdings for a wallet using direct RPC (native SOL + SPL tokens)
const getWalletHoldings = async (
  walletAddress: string,
): Promise<
  Array<{
    mint: string;
    balance: number;
    decimals: number;
  }>
> => {
  try {
    console.debug(`Fetching token holdings for wallet: ${walletAddress}`);
    const owner = new PublicKey(walletAddress);

    const [lamports, tokenAccounts] = await Promise.all([
      rpcService.getBalance(walletAddress).catch((err) => {
        console.warn("Failed to fetch SOL balance for holdings", err);
        return 0;
      }),
      rpcService.getParsedTokenAccountsByOwner(owner).catch((err) => {
        console.warn("Failed to fetch token accounts for holdings", err);
        return [];
      }),
    ]);

    const holdings: Array<{
      mint: string;
      balance: number;
      decimals: number;
    }> = [];

    if (lamports > 0) {
      holdings.push({
        mint: SOL_MINT,
        balance: lamports / LAMPORTS_PER_SOL,
        decimals: 9,
      });
    }

    tokenAccounts.forEach((account) => {
      if (account.uiAmount > 0) {
        holdings.push({
          mint: account.mint,
          balance: account.uiAmount,
          decimals: account.decimals ?? 0,
        });
      }
    });

    console.debug(`Processed ${holdings.length} holdings from RPC`);
    return holdings;
  } catch (error) {
    console.error(`Error fetching wallet holdings:`, error);
    return [];
  }
};

// Fetch token metadata using Jupiter /tokens/v2/search
const fetchTokenMetadata = async (
  mints: string[],
): Promise<Record<string, TokenMetadata>> => {
  if (mints.length === 0) {
    return {};
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  const BATCH_SIZE = 50;
  const metadataMap: Record<string, TokenMetadata> = {};

  try {
    if (mints.length <= BATCH_SIZE) {
      const batchResult = await fetchMetadataBatch(mints, headers);
      Object.assign(metadataMap, batchResult);
    } else {
      const batches: string[][] = [];
      for (let i = 0; i < mints.length; i += BATCH_SIZE) {
        batches.push(mints.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        try {
          const batchResult = await fetchMetadataBatch(batch, headers);
          Object.assign(metadataMap, batchResult);
        } catch (batchError) {
          console.error(`Error fetching metadata batch:`, batchError);
        }
      }
    }

    return metadataMap;
  } catch (error) {
    console.error(`Error in fetchTokenMetadata:`, error);
    return {};
  }
};

const fetchMetadataBatch = async (
  mints: string[],
  headers: HeadersInit,
): Promise<Record<string, TokenMetadata>> => {
  if (mints.length === 0) {
    return {};
  }

  try {
    const metadataMap: Record<string, TokenMetadata> = {};

    // Fetch metadata for each mint individually (search endpoint)
    for (const mint of mints) {
      try {
        const url = `${JUPITER_TOKENS_API}/search?query=${encodeURIComponent(mint)}`;
        const response = await fetch(url, {
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            `Jupiter metadata API error for ${mint}: ${response.status}`,
            {
              url,
              error: errorText,
            },
          );
          continue;
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const token = data[0];
          metadataMap[mint] = {
            address: token.id,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.icon,
          };
        }
      } catch (error) {
        console.warn(`Error fetching metadata for ${mint}:`, error);
        continue;
      }
    }

    return metadataMap;
  } catch (error) {
    console.error(`Error in fetchMetadataBatch:`, error);
    return {};
  }
};

const fetchJupiterTokens = async (): Promise<JupiterToken[]> => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  try {
    // Fix: Change parameter from tag=verified to query=verified
    const url = `${JUPITER_TOKENS_API}/tag?query=verified`;
    console.debug("Fetching Jupiter tokens with URL:", url);

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jupiter tokens API error: ${response.status}`, {
        url,
        error: errorText,
        headers: { ...headers, "x-api-key": "[REDACTED]" }, // Don't log actual API key
      });
      throw new Error(
        `Jupiter tokens API error: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    console.debug(
      `Successfully fetched ${Array.isArray(data) ? data.length : 0} tokens from Jupiter`,
    );
    return data;
  } catch (error) {
    console.error("Error fetching Jupiter tokens:", error);
    throw error;
  }
};

const parsePriceValue = (value?: number | string): number | null => {
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
};

const fetchJupiterPrices = async (
  mints: string[],
): Promise<JupiterPriceResponse> => {
  if (mints.length === 0) {
    return {};
  }

  // Validate and clean mint addresses
  const validatedMints = mints
    .map((mint) => mint.trim())
    .filter(isValidMintAddress)
    .map((mint) => mint.toUpperCase());

  if (validatedMints.length === 0) {
    console.warn("No valid mint addresses provided");
    return {};
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  const BATCH_SIZE = 50;
  const results: JupiterPriceResponse = {};

  try {
    // Process in batches to avoid API limits
    if (validatedMints.length <= BATCH_SIZE) {
      // Single batch
      const batchResult = await fetchPriceBatch(validatedMints, headers);
      Object.assign(results, batchResult);
    } else {
      // Multiple batches
      const batches: string[][] = [];
      for (let i = 0; i < validatedMints.length; i += BATCH_SIZE) {
        batches.push(validatedMints.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        try {
          const batchResult = await fetchPriceBatch(batch, headers);
          Object.assign(results, batchResult);
        } catch (batchError) {
          console.error(`Error fetching batch:`, batchError);
          // Continue with other batches even if one fails
        }
      }
    }

    // If no results, fallback to SOL mint test
    if (Object.keys(results).length === 0) {
      console.warn("No price results, falling back to SOL mint test");
      const solResult = await fetchPriceBatch([SOL_MINT], headers);
      Object.assign(results, solResult);
    }

    return results;
  } catch (error) {
    console.error("Error in fetchJupiterPrices:", error);
    // Fallback to SOL mint test
    try {
      console.warn("Falling back to SOL mint test due to error");
      const solResult = await fetchPriceBatch([SOL_MINT], headers);
      return solResult;
    } catch (fallbackError) {
      console.error("Fallback SOL mint test failed:", fallbackError);
      return {};
    }
  }
};

const fetchPriceBatch = async (
  mints: string[],
  headers: HeadersInit,
): Promise<JupiterPriceResponse> => {
  if (mints.length === 0) {
    return {};
  }

  try {
    // Build query with join(',') and encodeURIComponent
    const ids = mints.join(",");
    const encodedIds = encodeURIComponent(ids);
    const url = `${JUPITER_PRICE_API}?ids=${encodedIds}`;

    console.debug(`Fetching prices for ${mints.length} mints:`, {
      first: mints[0],
      last: mints[mints.length - 1],
      count: mints.length,
    });

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jupiter price API error: ${response.status}`, {
        url,
        error: errorText,
        mintCount: mints.length,
      });
      throw new Error(
        `Jupiter price API error: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    const normalized: JupiterPriceResponse = {};

    mints.forEach((mint) => {
      const price = data[mint]?.usdPrice;
      if (typeof price === "number" && Number.isFinite(price)) {
        normalized[mint] = price;
      }
    });

    return normalized;
  } catch (error) {
    console.error(`Error fetching price batch:`, error);
    throw error;
  }
};

export const tokenMetadataService = {
  async getTokenBalancesForWallet(
    walletAddress: string,
  ): Promise<TokenBalance[]> {
    const inMemoryEntry = walletBalanceCache.get(walletAddress);
    if (inMemoryEntry && inMemoryEntry.expiry > Date.now()) {
      return inMemoryEntry.data;
    }

    if (inMemoryEntry?.inFlight) {
      return inMemoryEntry.inFlight;
    }

    const persistedCache = await getWalletBalancesCache();
    const persistedEntry = persistedCache[walletAddress];
    if (persistedEntry && persistedEntry.expiry > Date.now()) {
      walletBalanceCache.set(walletAddress, persistedEntry);
      return persistedEntry.data;
    }

    const fetchPromise = (async () => {
      try {
        // Step 1: Get actual token holdings from RPC
        const holdings = await getWalletHoldings(walletAddress);

        if (holdings.length === 0) {
          console.debug(`No token holdings found for wallet: ${walletAddress}`);
          const emptyEntry: WalletBalanceCacheEntry = {
            data: [],
            expiry: Date.now() + WALLET_BALANCE_TTL,
          };
          walletBalanceCache.set(walletAddress, emptyEntry);

          const mergedCache = {
            ...(walletBalancesCache || {}),
            [walletAddress]: emptyEntry,
          };
          await persistWalletBalancesCache(mergedCache);

          return [];
        }

        // Step 2: Extract unique mints
        const mints = Array.from(new Set(holdings.map((h) => h.mint)));
        console.debug(`Processing ${mints.length} unique mints`);

        // Step 3: Fetch token metadata using Jupiter /tokens/v2/search
        const metadataMap = await fetchTokenMetadata(mints);
        console.debug(
          `Fetched metadata for ${Object.keys(metadataMap).length} mints`,
        );

        // Step 4: Fetch prices using Jupiter /price/v3
        const prices = await fetchJupiterPrices(mints);
        console.debug(`Fetched prices for ${Object.keys(prices).length} mints`);

        // Step 5: Combine holdings with metadata and prices
        const tokenBalances: TokenBalance[] = holdings.map((holding) => {
          const metadata = metadataMap[holding.mint];
          const price = prices[holding.mint];
          const usdValue = price ? holding.balance * price : undefined;

          return {
            mint: holding.mint,
            symbol: metadata?.symbol,
            name: metadata?.name,
            balance: holding.balance,
            decimals: holding.decimals,
            usdValue,
            pricePerToken: price,
            logoURI: metadata?.logoURI,
          };
        });

        // Calculate total USD value
        const totalUsdValue = tokenBalances.reduce(
          (sum, token) => sum + (token.usdValue || 0),
          0,
        );
        console.debug(`Total wallet value: $${totalUsdValue.toFixed(2)}`);

        // Log breakdown
        console.debug(
          "Token breakdown:",
          tokenBalances.map((token) => ({
            mint: token.mint,
            symbol: token.symbol,
            balance: token.balance,
            usdValue: token.usdValue,
          })),
        );

        const entry: WalletBalanceCacheEntry = {
          data: tokenBalances,
          expiry: Date.now() + WALLET_BALANCE_TTL,
        };
        walletBalanceCache.set(walletAddress, entry);

        const mergedCache = {
          ...(walletBalancesCache || {}),
          [walletAddress]: entry,
        };
        await persistWalletBalancesCache(mergedCache);

        return tokenBalances;
      } catch (error) {
        console.warn("Failed to fetch token balances from Jupiter", error);
        throw error;
      }
    })();

    walletBalanceCache.set(walletAddress, {
      data: [],
      expiry: 0,
      inFlight: fetchPromise,
    });

    try {
      return await fetchPromise;
    } catch (error) {
      console.warn("Failed to fetch token balances", error);
      walletBalanceCache.delete(walletAddress);
      if (walletBalancesCache?.[walletAddress]) {
        const updatedCache = { ...walletBalancesCache };
        delete updatedCache[walletAddress];
        await persistWalletBalancesCache(updatedCache);
      }
      return [];
    }
  },

  async getMetadataMapForWallet(
    walletAddress: string,
    mints: string[],
  ): Promise<Record<string, TokenMetadata>> {
    try {
      const map = await getMetadataCache();
      const responseMap = mints.reduce(
        (acc, mint) => {
          if (map[mint]) {
            acc[mint] = map[mint];
          }
          return acc;
        },
        {} as Record<string, TokenMetadata>,
      );

      const missingMints = mints.filter((mint) => !map[mint]);
      if (missingMints.length === 0) {
        return responseMap;
      }

      // Get all tokens from Jupiter
      const tokens = await fetchJupiterTokens();
      const tokenMetadataList = tokens
        .filter(
          (token: JupiterToken) => token.id && missingMints.includes(token.id),
        )
        .map((token: JupiterToken) => ({
          address: token.id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.icon,
        }));

      const mergedMap = {
        ...map,
        ...buildMetadataMap(tokenMetadataList),
      };
      await persistMetadataCache(mergedMap);

      return mints.reduce(
        (acc, mint) => {
          if (mergedMap[mint]) {
            acc[mint] = mergedMap[mint];
          }
          return acc;
        },
        {} as Record<string, TokenMetadata>,
      );
    } catch (error) {
      console.warn("Failed to fetch token metadata from Jupiter", error);
      return {};
    }
  },

  async getTokenPrices(mints: string[]): Promise<Record<string, number>> {
    try {
      return fetchJupiterPrices(mints);
    } catch (error) {
      console.warn("Failed to fetch token prices from Jupiter", error);
      return {};
    }
  },
};
