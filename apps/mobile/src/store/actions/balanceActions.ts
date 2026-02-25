import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { SolanaStoreState } from "../solanaStore";
import { rpcService, priceService, tokenMetadataService } from "../../services";
import type { WalletBalance } from "../../types/wallet";
import {
  useWalletBalanceStore,
  useWalletHistoricalStore,
} from "../walletStore";

export const createBalanceActions = (
  set: any,
  get: () => SolanaStoreState,
) => ({
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
      const [solPrice, tokenAccounts] = await Promise.all([
        priceService.getSolPriceInUsd(),
        rpcService.getParsedTokenAccountsByOwner(
          new PublicKey(targetAddress),
        ),
      ]);

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

      if (tokensWithBalance.length === 0) {
        tokenBalances =
          await tokenMetadataService.getTokenBalancesForWallet(
            targetAddress,
          );
      }

      const isNativeSol = (mint: string, symbol?: string) => {
        if (symbol === "SOL") return true;
        return (
          mint === "So11111111111111111111111111111111111111111" ||
          mint === "So11111111111111111111111111111111111111112"
        );
      };

      const filteredTokenBalances = tokenBalances.filter(
        (token) => !isNativeSol(token.mint, token.symbol),
      );

      const mints =
        tokensWithBalance.length > 0
          ? tokensWithBalance.map((token) => token.mint)
          : filteredTokenBalances.map((token) => token.mint);

      const [mintPrices, metadataMap] = await Promise.all([
        priceService.getTokenPricesInUsd(mints),
        tokenMetadataService.getMetadataMapForWallet(targetAddress, mints),
      ]);

      const missingPrices: string[] = [];
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

      const solToken = {
        mint: "So11111111111111111111111111111111111111111",
        symbol: "SOL",
        name: "Solana",
        balance: solBalance,
        usdValue: solBalance * solPrice,
        decimals: 9,
      };

      tokenDetails.unshift(solToken);

      totalUsdValue = tokenDetails.reduce(
        (sum, token) => sum + token.usdValue,
        0,
      );
    } catch (pricingError) {
      console.warn("Failed to aggregate token prices", pricingError);
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

    const walletBalance: WalletBalance = {
      address: targetAddress,
      balance: solBalance,
      usdValue: Number(totalUsdValue.toFixed(2)),
      lastUpdated: now,
      tokens: tokenDetails,
      totalTokens: tokenDetails.length,
      totalValue: Number(totalUsdValue.toFixed(2)),
    };

    set((prev: SolanaStoreState) => ({
      detailedBalances: {
        ...prev.detailedBalances,
        [targetAddress]: walletBalance,
      },
      isLoading: false,
    }));

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