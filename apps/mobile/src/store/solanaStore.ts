import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import type {
  SilentReauthorizationRecord,
  WalletCapabilityReport,
} from "@wallethub/contracts";
import { walletService } from "../services/walletService";
import { authorizationApi } from "../services/authorizationService";
import { rpcService } from "../services/rpcService";
import { priceService } from "../services/priceService";
import { tokenMetadataService } from "../services/tokenMetadataService";
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";
import { decodeWalletAddress } from "../utils/solanaAddress";
import { LinkedWallet, AuthorizationPreview, WalletBalance } from "../types/wallet";
import { useWalletBalanceStore, useWalletHistoricalStore } from "./walletStore";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
};

const DEFAULT_CAPABILITIES: WalletCapabilityReport = {
  supportsCloneAuthorization: false,
  supportsSignAndSendTransactions: true,
  supportsSignTransactions: true,
  supportsSignMessages: false,
  maxTransactionsPerRequest: 10,
  maxMessagesPerRequest: 10,
  supportedTransactionVersions: [],
  featureFlags: [],
};

type WalletCapabilitiesResponse = Awaited<
  ReturnType<Web3MobileWallet["getCapabilities"]>
> | null;

const mapCapabilities = (
  capabilities: WalletCapabilitiesResponse,
): WalletCapabilityReport => {
  if (!capabilities) {
    return { ...DEFAULT_CAPABILITIES };
  }

  const featureFlags = Array.isArray(capabilities.features)
    ? capabilities.features.map(String)
    : [];

  return {
    supportsCloneAuthorization:
      capabilities.supports_clone_authorization ||
      featureFlags.includes("solana:cloneAuthorization"),
    supportsSignAndSendTransactions:
      capabilities.supports_sign_and_send_transactions ||
      featureFlags.includes("solana:signAndSendTransactions"),
    supportsSignTransactions:
      featureFlags.includes("solana:signTransactions") ||
      DEFAULT_CAPABILITIES.supportsSignTransactions,
    supportsSignMessages: featureFlags.includes("solana:signMessages"),
    maxTransactionsPerRequest: capabilities.max_transactions_per_request,
    maxMessagesPerRequest: capabilities.max_messages_per_request,
    supportedTransactionVersions: capabilities.supported_transaction_versions
      ? capabilities.supported_transaction_versions.map(String)
      : DEFAULT_CAPABILITIES.supportedTransactionVersions,
    featureFlags,
  };
};

interface SolanaStoreState {
  // Wallet connection state
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  activeWalletAddress: string | null;
  isAuthenticated: boolean;
  
  // Balance state
  balances: Record<string, number>;
  detailedBalances: Record<string, WalletBalance>;
  
  // Transaction state
  isLoading: boolean;
  error: string | null;
  
  // Connection
  connection: Connection;
  
  // Actions
  disconnect: (address?: string) => Promise<void>;
  sendSol: (
    recipient: string,
    amountSol: number,
    options?: { fromAddress?: string },
  ) => Promise<string>;
  registerPrimaryWallet: () => Promise<LinkedWallet[]>;
  selectActiveWallet: (address: string) => void;
  refreshBalance: (address?: string) => Promise<number | null>;
  startAuthorization: () => Promise<AuthorizationPreview>;
  finalizeAuthorization: (
    preview: AuthorizationPreview,
    selectedAddresses?: string[],
  ) => Promise<LinkedWallet[]>;
  silentRefreshAuthorization: (
    address?: string,
  ) => Promise<SilentReauthorizationRecord | null>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useSolanaStore = create<SolanaStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      linkedWallets: [],
      activeWallet: null,
      activeWalletAddress: null,
      isAuthenticated: false,
      balances: {},
      detailedBalances: {},
      isLoading: false,
      error: null,
      connection: new Connection(HELIUS_RPC_URL, "confirmed"),

      // Set loading state
      setLoading: (loading) => set({ isLoading: loading }),
      
      // Set error state
      setError: (error) => set({ error }),
      
      // Clear error
      clearError: () => set({ error: null }),

      // Select active wallet
      selectActiveWallet: (address) => {
        const state = get();
        const wallet = state.linkedWallets.find((w) => w.address === address) || null;
        set({
          activeWallet: wallet,
          activeWalletAddress: wallet?.address || null,
          isAuthenticated: !!wallet,
        });
      },

      // Refresh balance
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
          set((prev) => ({
            balances: {
              ...prev.balances,
              [targetAddress]: balance,
            },
          }));
        } catch (error) {
          console.warn("Error refreshing balance", error);
          set((prev) => {
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
            tokenBalances = await tokenMetadataService.getTokenBalancesForWallet(targetAddress);
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

          const mints = tokensWithBalance.length > 0
            ? tokensWithBalance.map((token) => token.mint)
            : filteredTokenBalances.map((token) => token.mint);

          const [mintPrices, metadataMap] = await Promise.all([
            priceService.getTokenPricesInUsd(mints),
            tokenMetadataService.getMetadataMapForWallet(targetAddress, mints),
          ]);

          const missingPrices: string[] = [];
          tokenDetails = tokensWithBalance.length > 0
            ? tokensWithBalance.map((token) => {
                const price = mintPrices[token.mint];
                if (price === undefined) {
                  missingPrices.push(
                    metadataMap[token.mint]?.symbol ?? token.mint,
                  );
                }

                const balance = token.uiAmount;
                const usdValue = typeof price === "number" ? balance * price : 0;

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
                const price = mintPrices[token.mint] ?? token.pricePerToken ?? 0;
                if (!price) {
                  missingPrices.push(token.symbol ?? token.mint);
                }

                const balance = token.balance;
                const usdValue = typeof price === "number"
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

          const tokenUsdValue = tokenDetails.reduce(
            (sum, token) => sum + token.usdValue,
            0,
          );

          totalUsdValue = solBalance * solPrice + tokenUsdValue;
        } catch (pricingError) {
          console.warn("Failed to aggregate token prices", pricingError);
          const solPrice = await priceService.getSolPriceInUsd().catch(() => 0);
          totalUsdValue = solBalance * solPrice;
        }

        const walletBalance: WalletBalance = {
          address: targetAddress,
          balance: solBalance,
          usdValue: Number(totalUsdValue.toFixed(2)),
          lastUpdated: now,
          tokens: tokenDetails,
        };

        // Update state
        set((prev) => ({
          detailedBalances: {
            ...prev.detailedBalances,
            [targetAddress]: walletBalance,
          },
          isLoading: false,
        }));

        // Also update wallet balance store for consistency
        const walletBalanceStore = useWalletBalanceStore.getState();
        const walletHistoricalStore = useWalletHistoricalStore.getState();
        walletBalanceStore.updateDetailedBalance(walletBalance);
        walletHistoricalStore.updateHistoricalBalance(targetAddress, {
          timestamp: Date.now(),
          usd: walletBalance.usdValue,
          sol: walletBalance.balance,
        });

        return balance;
      },

      // Start authorization
      startAuthorization: async () => {
        try {
          set({ isLoading: true, error: null });
          const result = await walletService.startWalletAuthorization();
          set({ isLoading: false });
          return result;
        } catch (error) {
          console.error("Wallet authorization failed", error);
          const errorMessage = error instanceof Error ? error.message : "Authorization failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      // Finalize authorization
      finalizeAuthorization: async (preview, selectedAddresses) => {
        try {
          set({ isLoading: true, error: null });
          const accountsToLink = await walletService.finalizeWalletAuthorization(
            preview,
            selectedAddresses,
          );

          set((prev) => {
            const updatedWallets = [...prev.linkedWallets];
            accountsToLink.forEach((walletAccount) => {
              const existingIndex = updatedWallets.findIndex(
                (entry) => entry.address === walletAccount.address,
              );
              if (existingIndex >= 0) {
                updatedWallets[existingIndex] = {
                  ...updatedWallets[existingIndex],
                  ...walletAccount,
                };
              } else {
                updatedWallets.push(walletAccount);
              }
            });

            const activeWallet = prev.activeWallet || accountsToLink[0];
            
            return {
              linkedWallets: updatedWallets,
              activeWallet,
              activeWalletAddress: activeWallet?.address || null,
              isAuthenticated: updatedWallets.length > 0,
              isLoading: false,
            };
          });

          // Refresh balances for all linked wallets
          await Promise.all(
            accountsToLink.map((walletAccount) =>
              get().refreshBalance(walletAccount.address).catch((err) => {
                console.warn("Balance refresh failed post-connect", err);
              }),
            ),
          );

          // Set primary wallet if not set
          const walletState = useWalletBalanceStore.getState();
          if (!walletState.primaryWalletAddress && accountsToLink.length > 0) {
            walletState.setPrimaryWalletAddress(accountsToLink[0].address);
          }

          return accountsToLink;
        } catch (error) {
          console.error("Error finalizing authorization:", error);
          const errorMessage = error instanceof Error ? error.message : "Authorization failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      // Register primary wallet
      registerPrimaryWallet: async () => {
        try {
          set({ isLoading: true, error: null });
          await requireBiometricApproval("Authenticate to register wallet", {
            allowSessionReuse: true,
          });
          const preview = await get().startAuthorization();
          const accounts = await get().finalizeAuthorization(preview);
          
          if (accounts.length > 0) {
            const walletState = useWalletBalanceStore.getState();
            walletState.setPrimaryWalletAddress(accounts[0].address);
          }
          
          return accounts;
        } catch (error) {
          console.error("Register primary wallet failed", error);
          const errorMessage = error instanceof Error ? error.message : "Registration failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      // Silent refresh authorization
      silentRefreshAuthorization: async (address?: string) => {
        const state = get();
        const targetAddress = address ?? state.activeWallet?.address;
        if (!targetAddress) {
          throw new Error("Select a wallet to refresh authorization");
        }

        const walletEntry = state.linkedWallets.find(
          (wallet) => wallet.address === targetAddress,
        );
        if (!walletEntry) {
          throw new Error("Wallet not linked");
        }

        let reauthMethod: "silent" | "prompted" = "silent";

        try {
          set({ isLoading: true, error: null });
          const result = await transact(async (wallet: Web3MobileWallet) => {
            const capabilities = await wallet.getCapabilities().catch((err) => {
              console.warn("Capability probe failed", err);
              return null;
            });

            let authorization: AuthorizationResult;
            try {
              authorization = await wallet.reauthorize({
                identity: APP_IDENTITY,
                auth_token: walletEntry.authToken,
              });
            } catch (error) {
              reauthMethod = "prompted";
              authorization = await wallet.authorize({
                identity: APP_IDENTITY,
                chain: SOLANA_CLUSTER,
                features: [
                  "solana:signAndSendTransactions",
                  "solana:signTransactions",
                  "solana:signMessages",
                ],
              });
            }

            return { authorization, capabilities };
          });

          // Normalize authorization
          const normalizeAuthorization = (authorization: AuthorizationResult): LinkedWallet[] =>
            authorization.accounts.map(
              (accountFromWallet: { address: string; label?: string }) => ({
                address: decodeWalletAddress(accountFromWallet.address),
                label: accountFromWallet.label,
                authToken: authorization.auth_token,
                walletName: accountFromWallet.label,
                icon: (authorization as any).wallet_icon,
              }),
            );

          const normalizedAccounts = normalizeAuthorization(result.authorization);

          // Update wallets
          set((prev) => {
            const updatedWallets = [...prev.linkedWallets];
            normalizedAccounts.forEach((walletAccount) => {
              const existingIndex = updatedWallets.findIndex(
                (entry) => entry.address === walletAccount.address,
              );
              if (existingIndex >= 0) {
                updatedWallets[existingIndex] = {
                  ...updatedWallets[existingIndex],
                  ...walletAccount,
                };
              } else {
                updatedWallets.push(walletAccount);
              }
            });

            return {
              linkedWallets: updatedWallets,
            };
          });

          const refreshedAccount =
            normalizedAccounts.find(
              (account) => account.address === walletEntry.address,
            ) ?? normalizedAccounts[0];

          if (!refreshedAccount) {
            throw new Error("Wallet did not return any accounts");
          }

          const recorded = await authorizationApi
            .recordSilentReauthorization({
              walletAddress: refreshedAccount.address,
              walletAppId:
                refreshedAccount.walletAppId ?? walletEntry.walletAppId,
              walletName: refreshedAccount.walletName ?? walletEntry.walletName,
              authToken: refreshedAccount.authToken,
              method: reauthMethod,
              capabilities: mapCapabilities(result.capabilities),
            })
            .catch((err) => {
              console.warn("Failed to persist silent re-authorization", err);
              return null;
            });

          set({ isLoading: false });
          return recorded;
        } catch (error) {
          console.error("Silent re-authorization failed", error);
          try {
            await authorizationApi.recordSilentReauthorization({
              walletAddress: walletEntry.address,
              walletAppId: walletEntry.walletAppId,
              walletName: walletEntry.walletName,
              method: reauthMethod,
              capabilities: { ...DEFAULT_CAPABILITIES },
              error: error instanceof Error ? error.message : "unknown_error",
            });
          } catch (persistError) {
            console.warn(
              "Failed to record silent re-authorization failure",
              persistError,
            );
          }

          const errorMessage = error instanceof Error ? error.message : "Re-authorization failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      // Disconnect wallet
      disconnect: async (address?: string) => {
        const state = get();
        const targetAddress = address ?? state.activeWallet?.address;
        if (!targetAddress) return;

        const walletEntry = state.linkedWallets.find(
          (wallet) => wallet.address === targetAddress,
        );

        if (walletEntry) {
          const remainingWithToken = state.linkedWallets.filter(
            (wallet) =>
              wallet.authToken === walletEntry.authToken &&
              wallet.address !== targetAddress,
          );
          if (remainingWithToken.length === 0) {
            try {
              await transact(async (wallet) => {
                await wallet.deauthorize({ auth_token: walletEntry.authToken });
              });
            } catch (error) {
              console.warn("Deauthorize failed (ignored)", error);
            }
          }
        }

        set((prev) => {
          const nextWallets = prev.linkedWallets.filter(
            (wallet) => wallet.address !== targetAddress,
          );
          const nextActiveWallet = prev.activeWallet?.address === targetAddress
            ? nextWallets[0] || null
            : prev.activeWallet;
          
          const nextBalances = { ...prev.balances };
          delete nextBalances[targetAddress];
          
          const nextDetailedBalances = { ...prev.detailedBalances };
          delete nextDetailedBalances[targetAddress];

          return {
            linkedWallets: nextWallets,
            activeWallet: nextActiveWallet,
            activeWalletAddress: nextActiveWallet?.address || null,
            isAuthenticated: nextWallets.length > 0,
            balances: nextBalances,
            detailedBalances: nextDetailedBalances,
          };
        });

        // Also update wallet store
        const walletStore = useWalletBalanceStore.getState();
        walletStore.removeWallet(targetAddress);
      },

      // Send SOL
      sendSol: async (recipient, amountSol, options) => {
        const state = get();
        
        if (!recipient) {
          throw new Error("Recipient address is required");
        }
        if (amountSol <= 0) {
          throw new Error("Amount must be greater than zero");
        }
        if (amountSol > 100000) {
          throw new Error("Amount exceeds maximum allowed value");
        }

        const sourceAddress = options?.fromAddress ?? state.activeWallet?.address;
        if (!sourceAddress) {
          throw new Error("Select a wallet before sending");
        }

        if (sourceAddress === recipient) {
          throw new Error("Cannot send SOL to the same address");
        }

        const walletEntry = state.linkedWallets.find(
          (wallet) => wallet.address === sourceAddress,
        );
        if (!walletEntry) {
          throw new Error("Wallet not linked");
        }

        // Check if balance is sufficient
        const currentBalance = state.balances[sourceAddress];
        if (currentBalance && currentBalance < amountSol * LAMPORTS_PER_SOL) {
          throw new Error("Insufficient balance");
        }

        try {
          set({ isLoading: true, error: null });
          
          // Require biometric approval
          await requireBiometricApproval("Authenticate to send SOL");

          let senderPubkey: PublicKey;
          let recipientPubkey: PublicKey;
          try {
            senderPubkey = new PublicKey(sourceAddress);
          } catch (error) {
            throw new Error("Invalid source wallet address");
          }

          try {
            recipientPubkey = new PublicKey(recipient);
          } catch (error) {
            throw new Error("Invalid recipient address");
          }

          let reauthMethod: "silent" | "prompted" = "silent";
          let capabilityReport: WalletCapabilityReport = {
            ...DEFAULT_CAPABILITIES,
          };
          let refreshedAccount: LinkedWallet | null = null;
          const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
          const latestBlockhash = await state.connection.getLatestBlockhash();
          const transaction = new Transaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            feePayer: senderPubkey,
          }).add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipientPubkey,
              lamports,
            }),
          );

          let fallbackSignedTransaction: Transaction | null = null;
          let submittedSignature: string | null = null;

          await transact(async (wallet: Web3MobileWallet) => {
            let authorization: AuthorizationResult;
            const capabilities = await wallet.getCapabilities().catch((err) => {
              console.warn("Capability probe failed", err);
              return null;
            });
            capabilityReport = mapCapabilities(capabilities);

            try {
              authorization = await wallet.reauthorize({
                identity: APP_IDENTITY,
                auth_token: walletEntry.authToken,
              });
            } catch (error) {
              console.warn(
                "Reauthorize failed, requesting fresh authorization",
                error,
              );
              reauthMethod = "prompted";
              authorization = await wallet.authorize({
                identity: APP_IDENTITY,
                chain: SOLANA_CLUSTER,
                features: [
                  "solana:signAndSendTransactions",
                  "solana:signTransactions",
                ],
              });
            }

            // Normalize authorization
            const normalizeAuthorization = (authorization: AuthorizationResult): LinkedWallet[] =>
              authorization.accounts.map(
                (accountFromWallet: { address: string; label?: string }) => ({
                  address: decodeWalletAddress(accountFromWallet.address),
                  label: accountFromWallet.label,
                  authToken: authorization.auth_token,
                  walletName: accountFromWallet.label,
                  icon: (authorization as any).wallet_icon,
                }),
              );

            const normalizedAccounts = normalizeAuthorization(authorization);

            // Update wallets
            set((prev) => {
              const updatedWallets = [...prev.linkedWallets];
              normalizedAccounts.forEach((walletAccount) => {
                const existingIndex = updatedWallets.findIndex(
                  (entry) => entry.address === walletAccount.address,
                );
                if (existingIndex >= 0) {
                  updatedWallets[existingIndex] = {
                    ...updatedWallets[existingIndex],
                    ...walletAccount,
                  };
                } else {
                  updatedWallets.push(walletAccount);
                }
              });

              return {
                linkedWallets: updatedWallets,
              };
            });

            const primaryAccount: LinkedWallet | undefined =
              normalizedAccounts.find(
                (account: LinkedWallet) => account.address === sourceAddress,
              ) ?? normalizedAccounts[0];

            if (primaryAccount) {
              refreshedAccount = primaryAccount;
            }

            if (!primaryAccount) {
              throw new Error("Wallet did not return the requested account");
            }

            const canSignAndSend =
              capabilityReport.supportsSignAndSendTransactions !== false;
            const canSign =
              capabilityReport.supportsSignTransactions ??
              DEFAULT_CAPABILITIES.supportsSignTransactions;

            if (canSignAndSend) {
              const [signature] = await wallet.signAndSendTransactions({
                transactions: [transaction],
              });
              submittedSignature = signature;
              return;
            }

            if (!canSign) {
              throw new Error("Wallet cannot sign transactions");
            }

            const signedTransactions = await wallet.signTransactions({
              transactions: [transaction],
            });
            fallbackSignedTransaction = signedTransactions[0] ?? null;
          });

          if (!submittedSignature) {
            if (!fallbackSignedTransaction) {
              throw new Error("No signed transaction returned by wallet");
            }
            try {
              submittedSignature = await state.connection.sendRawTransaction(
                (fallbackSignedTransaction as Transaction).serialize(),
                {
                  skipPreflight: false,
                },
              );
            } catch (error) {
              console.error("sendRawTransaction failed", error);
              throw error;
            }
          }

          try {
            await state.connection.confirmTransaction(
              {
                signature: submittedSignature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              "confirmed",
            );
          } catch (error) {
            console.warn("Transaction confirmation failed", error);
          }

          // Refresh balance after send
          await state.refreshBalance(sourceAddress).catch((err) => {
            console.warn("Failed to refresh balance after send", err);
          });

          if (refreshedAccount) {
            const account = refreshedAccount as LinkedWallet;
            authorizationApi
              .recordSilentReauthorization({
                walletAddress: account.address,
                walletAppId: account.walletAppId ?? walletEntry.walletAppId,
                walletName: account.walletName ?? walletEntry.walletName,
                authToken: account.authToken,
                method: reauthMethod,
                capabilities: capabilityReport,
              })
              .catch((err) => {
                console.warn(
                  "Failed to persist silent re-authorization event",
                  err,
                );
              });

            authorizationApi
              .recordTransactionAudit({
                signature: submittedSignature,
                sourceWalletAddress: account.address,
                destinationAddress: recipient,
                amountLamports: lamports,
                authorizationPrimitive: "silent-reauthorization",
                metadata: {
                  walletAppId: account.walletAppId ?? "unknown",
                  reauthorizationMethod: reauthMethod,
                  capabilities: (capabilityReport.featureFlags || []).join(","),
                },
              })
              .catch((err) => {
                console.warn("Failed to record transaction audit", err);
              });
          }

          set({ isLoading: false });
          return submittedSignature;
        } catch (error) {
          console.error("Send SOL failed", error);
          const errorMessage = error instanceof Error ? error.message : "Transaction failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: "solana-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        linkedWallets: state.linkedWallets,
        activeWallet: state.activeWallet,
        activeWalletAddress: state.activeWalletAddress,
        isAuthenticated: state.isAuthenticated,
        balances: state.balances,
        detailedBalances: state.detailedBalances,
      }),
    },
  ),
);

// Helper selectors
export const useSolanaSelectors = () => {
  const {
    linkedWallets,
    activeWallet,
    isAuthenticated,
    isLoading,
    error,
    connection,
    balances,
    detailedBalances,
  } = useSolanaStore();

  return {
    linkedWallets,
    activeWallet,
    isAuthenticated,
    isLoading,
    error,
    connection,
    balances,
    detailedBalances,
    hasActiveWallet: !!activeWallet,
    walletCount: linkedWallets.length,
    activeWalletBalance: activeWallet ? balances[activeWallet.address] || 0 : 0,
    activeWalletUsdValue: activeWallet ? detailedBalances[activeWallet.address]?.usdValue || 0 : 0,
  };
};
