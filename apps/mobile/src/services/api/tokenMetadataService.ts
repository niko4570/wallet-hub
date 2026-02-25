import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { cacheUtils } from "../../utils";
import { rpcService } from "../solana/rpcService";
import { priceService } from "./priceService";
import { jupiterService } from "./jupiterService";

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
  id?: string;
  address?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  logoURI?: string;
  decimals?: number;
  usdPrice?: number;
}

const WALLET_BALANCE_TTL = 30 * 1000;
const METADATA_TTL = 24 * 60 * 60 * 1000;
const JUPITER_TOKENS_API = "https://api.jup.ag/tokens/v2";
const METADATA_SEARCH_BATCH = 8;

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

const normalizeToken = (
  token: JupiterToken | undefined | null,
): TokenMetadata | null => {
  if (!token) {
    return null;
  }

  const address = token.address ?? token.id;
  if (!address) {
    return null;
  }

  return {
    address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI ?? token.icon,
  };
};

const fetchTokenMetadata = async (
  mints: string[],
): Promise<Record<string, TokenMetadata>> => {
  if (mints.length === 0) {
    return {};
  }

  const uniqueMints = Array.from(new Set(mints));
  const metadataMap: Record<string, TokenMetadata> = {};

  for (let i = 0; i < uniqueMints.length; i += METADATA_SEARCH_BATCH) {
    const batch = uniqueMints.slice(i, i + METADATA_SEARCH_BATCH);
    const results = await Promise.all(
      batch.map(async (mint) => {
        try {
          const data = await jupiterService.requestJson<JupiterToken[]>(
            `${JUPITER_TOKENS_API}/search`,
            {
              params: { query: mint },
              cacheTtlMs: METADATA_TTL / 12,
            },
          );
          return normalizeToken(Array.isArray(data) ? data[0] : undefined);
        } catch (error) {
          console.warn(`Error fetching metadata for ${mint}:`, error);
          return null;
        }
      }),
    );

    results.forEach((token, index) => {
      if (!token) {
        return;
      }
      const mint = batch[index];
      metadataMap[mint] = {
        address: token.address || mint,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
      };
    });
  }

  return metadataMap;
};

const ensureMetadataForMints = async (
  mints: string[],
): Promise<Record<string, TokenMetadata>> => {
  if (mints.length === 0) {
    return (metadataCache as Record<string, TokenMetadata>) || {};
  }

  const cachedMap = await getMetadataCache();
  const missingMints = mints.filter((mint) => !cachedMap[mint]);

  if (missingMints.length === 0) {
    return cachedMap;
  }

  const fetchedMap = await fetchTokenMetadata(missingMints);
  if (Object.keys(fetchedMap).length === 0) {
    return cachedMap;
  }

  const mergedMap = {
    ...cachedMap,
    ...fetchedMap,
  };

  await persistMetadataCache(mergedMap);
  return mergedMap;
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
        const metadataMap = await ensureMetadataForMints(mints);
        console.debug(
          `Fetched metadata for ${Object.keys(metadataMap).length} mints`,
        );

        // Step 4: Fetch prices using centralized priceService
        const prices = await priceService.getTokenPricesInUsd(mints);
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
    _walletAddress: string,
    mints: string[],
  ): Promise<Record<string, TokenMetadata>> {
    try {
      const mergedMap = await ensureMetadataForMints(mints);
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
};
