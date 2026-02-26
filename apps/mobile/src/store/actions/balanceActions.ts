import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { SolanaStoreState } from "../solanaStore";
import { rpcService, priceService, tokenMetadataService } from "../../services";
import type { WalletBalance } from "../../types/wallet";
import {
  useWalletBalanceStore,
  useWalletHistoricalStore,
} from "../walletStore";

/**
 * Creates balance-related actions for the Solana store.
 * Provides comprehensive wallet balance refresh functionality with:
 * - SOL balance fetching from RPC
 * - Token account parsing from both Token Program and Token-2022
 * - Price fetching for all tokens
 * - USD value calculation
 * - Historical balance tracking
 *
 * @param set - Zustand set function
 * @param get - Zustand get function
 * @returns Object containing balance-related actions
 */
export const createBalanceActions = (
  set: any,
  get: () => SolanaStoreState,
) => ({
  /**
   * Refreshes wallet balance for a specific address.
   * This is a comprehensive balance refresh that:
   * 1. Fetches SOL balance from RPC
   * 2. Gets all token accounts (SPL + Token-2022)
   * 3. Fetches token metadata from Jupiter API
   * 4. Fetches USD prices for all tokens
   * 5. Calculates total USD value
   * 6. Updates historical balance data
   *
   * The function handles two scenarios:
   * - RPC returns token accounts directly: Uses those accounts
   * - RPC returns no accounts: Falls back to tokenMetadataService
   *
   * @param address - Optional wallet address (uses active wallet if not provided)
   * @returns Promise resolving to balance in lamports, or null if failed
   *
   * @example
   * ```typescript
   * // Refresh active wallet balance
   * const balance = await refreshBalance();
   *
   * // Refresh specific wallet balance
   * const balance = await refreshBalance("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * ```
   */
  refreshBalance: async (address?: string) => {
    const state = get();
    const targetAddress = address ?? state.activeWallet?.address;
    if (!targetAddress) {
      return null;
    }

    set({ isLoading: true, error: null });

    let balance: number;
    try {
      balance = await rpcService.getBalance(targetAddress);
      set((prev: SolanaStoreState) => ({
        balances: {
          ...prev.balances,
          [targetAddress]: balance,
        },
      }));
    } catch (error) {
      console.warn("Error refreshing balance", error);
      set((prev: SolanaStoreState) => {
        const newBalances = { ...prev.balances };
        delete newBalances[targetAddress];
        const newDetailedBalances = { ...prev.detailedBalances };
        delete newDetailedBalances[targetAddress];
        return {
          balances: newBalances,
          detailedBalances: newDetailedBalances,
          error: "Failed to refresh balance",
          isLoading: false,
        };
      });
      throw error;
    }

    const now = new Date().toISOString();
    const solBalance = balance / LAMPORTS_PER_SOL;
    let totalUsdValue = 0;
    let tokenDetails: Array<{
      mint: string;
      symbol?: string;
      name?: string;
      balance: number;
      usdValue: number;
      decimals: number;
    }> = [];

    try {
      // Fetch SOL price and token accounts in parallel
      const [solPrice, tokenAccounts] = await Promise.all([
        priceService.getSolPriceInUsd(),
        rpcService.getParsedTokenAccountsByOwner(
          new PublicKey(targetAddress),
        ),
      ]);

      // Filter to only tokens with positive balance
      const tokensWithBalance = tokenAccounts.filter(
        (token) => token.uiAmount > 0,
      );

      let tokenBalances: Array<{
        mint: string;
        balance: number;
        decimals: number;
        symbol?: string;
        name?: string;
        pricePerToken?: number;
        usdValue?: number;
        logoURI?: string;
      }> = [];

      // If RPC returned token accounts, use them directly
      if (tokensWithBalance.length === 0) {
        // Fallback to tokenMetadataService if RPC returned no accounts
        tokenBalances =
          await tokenMetadataService.getTokenBalancesForWallet(
            targetAddress,
          );
      }

      // Helper function to check if mint is native SOL
      const isNativeSol = (mint: string, symbol?: string) => {
        if (symbol === "SOL") return true;
        return (
          mint === "So11111111111111111111111111111111111111111" ||
          mint === "So11111111111111111111111111111111111111112"
        );
      };

      // Filter out native SOL from token balances (we add it separately)
      const filteredTokenBalances = tokenBalances.filter(
        (token) => !isNativeSol(token.mint, token.symbol),
      );

      // Extract mints from either RPC accounts or tokenMetadataService
      const mints =
        tokensWithBalance.length > 0
          ? tokensWithBalance.map((token) => token.mint)
          : filteredTokenBalances.map((token) => token.mint);

      // Fetch prices and metadata for all tokens in parallel
      const [mintPrices, metadataMap] = await Promise.all([
        priceService.getTokenPricesInUsd(mints),
        tokenMetadataService.getMetadataMapForWallet(targetAddress, mints),
      ]);

      const missingPrices: string[] = [];

      // Build token details with prices and metadata
      tokenDetails =
        tokensWithBalance.length > 0
          ? tokensWithBalance.map((token) => {
              const price = mintPrices[token.mint];
              if (price === undefined) {
                missingPrices.push(
                  metadataMap[token.mint]?.symbol ?? token.mint,
                );
              }

              const balance = token.uiAmount;
              const usdValue =
                typeof price === "number" ? balance * price : 0;

              return {
                mint: token.mint,
                symbol: metadataMap[token.mint]?.symbol,
                name: metadataMap[token.mint]?.name,
                balance,
                usdValue,
                decimals: token.decimals,
              };
            })
          : filteredTokenBalances.map((token) => {
              const price =
                mintPrices[token.mint] ?? token.pricePerToken ?? 0;
              if (!price) {
                missingPrices.push(token.symbol ?? token.mint);
              }

              const balance = token.balance;
              const usdValue =
                typeof price === "number"
                  ? balance * price
                  : (token.usdValue ?? 0);

              return {
                mint: token.mint,
                symbol: token.symbol ?? metadataMap[token.mint]?.symbol,
                name: token.name ?? metadataMap[token.mint]?.name,
                balance,
                usdValue,
                decimals: token.decimals,
              };
            });

      // Add native SOL token to the beginning of the list
      const solToken = {
        mint: "So11111111111111111111111111111111111111111",
        symbol: "SOL",
        name: "Solana",
        balance: solBalance,
        usdValue: solBalance * solPrice,
        decimals: 9,
      };

      tokenDetails.unshift(solToken);

      // Calculate total USD value across all tokens
      totalUsdValue = tokenDetails.reduce(
        (sum, token) => sum + token.usdValue,
        0,
      );
    } catch (pricingError) {
      console.warn("Failed to aggregate token prices", pricingError);
      // Fallback to SOL-only balance if pricing fails
      const solPrice = await priceService.getSolPriceInUsd().catch(() => 0);
      totalUsdValue = solBalance * solPrice;

      tokenDetails = [
        {
          mint: "So11111111111111111111111111111111111111111",
          symbol: "SOL",
          name: "Solana",
          balance: solBalance,
          usdValue: solBalance * solPrice,
          decimals: 9,
        },
      ];
    }

    // Build complete wallet balance object
    const walletBalance: WalletBalance = {
      address: targetAddress,
      balance: solBalance,
      usdValue: Number(totalUsdValue.toFixed(2)),
      lastUpdated: now,
      tokens: tokenDetails,
      totalTokens: tokenDetails.length,
      totalValue: Number(totalUsdValue.toFixed(2)),
    };

    // Update store with detailed balance
    set((prev: SolanaStoreState) => ({
      detailedBalances: {
        ...prev.detailedBalances,
        [targetAddress]: walletBalance,
      },
      isLoading: false,
    }));

    // Update separate stores for balance and historical data
    const walletBalanceStore = useWalletBalanceStore.getState();
    const walletHistoricalStore = useWalletHistoricalStore.getState();
    walletBalanceStore.updateDetailedBalance(walletBalance);
    walletHistoricalStore.updateHistoricalBalance(
      state.network,
      targetAddress,
      {
        timestamp: Date.now(),
        usd: walletBalance.usdValue,
        sol: walletBalance.balance,
      },
    );

    return balance;
  },
});