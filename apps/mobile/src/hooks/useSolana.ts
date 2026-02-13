import { useCallback, useEffect, useMemo, useState } from "react";
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
  AuthorizationPrimitive,
} from "@wallethub/contracts";
import { walletService } from "../services/walletService";
import { authorizationApi } from "../services/authorizationService";
import { iconService } from "../services/iconService";
import { rpcService } from "../services/rpcService";
import { priceService } from "../services/priceService";
import { tokenMetadataService } from "../services/tokenMetadataService";
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";
import { decodeWalletAddress } from "../utils/solanaAddress";
import { useWalletStore } from "../store/walletStore";
import {
  LinkedWallet,
  DetectedWalletApp,
  AuthorizationPreview,
} from "../types/wallet";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
};

const DEFAULT_CAPABILITIES: WalletCapabilityReport = {
  supportsCloneAuthorization: false,
  supportsSignAndSendTransactions: true,
  supportsSignTransactions: true,
  supportsSignMessages: false,
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

/**
 * Shared Solana adapter hook that wraps Mobile Wallet Adapter authorization
 * and exposes helpers for connecting, disconnecting, sending, and refreshing balances.
 */

export interface UseSolanaResult {
  disconnect: (address?: string) => Promise<void>;
  sendSol: (
    recipient: string,
    amountSol: number,
    options?: { fromAddress?: string },
  ) => Promise<string>;
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  selectActiveWallet: (address: string) => void;
  connection: Connection;
  isAuthenticated: boolean;
  balances: Record<string, number>;
  detailedBalances: Record<
    string,
    {
      balance: number;
      usdValue: number;
      lastUpdated: string;
      tokens: Array<{
        mint: string;
        symbol?: string;
        name?: string;
        balance: number;
        usdValue: number;
        decimals: number;
      }>;
    }
  >;
  refreshBalance: (address?: string) => Promise<number | null>;
  availableWallets: DetectedWalletApp[];
  detectingWallets: boolean;
  refreshWalletDetection: () => Promise<DetectedWalletApp[]>;
  startAuthorization: (
    wallet?: DetectedWalletApp,
  ) => Promise<AuthorizationPreview>;
  finalizeAuthorization: (
    preview: AuthorizationPreview,
    selectedAddresses?: string[],
  ) => Promise<LinkedWallet[]>;
  silentRefreshAuthorization: (
    address?: string,
  ) => Promise<SilentReauthorizationRecord | null>;
}

/**
 * Shared Solana adapter hook that wraps Mobile Wallet Adapter authorization
 * and exposes helpers for connecting, disconnecting, sending, and refreshing balances.
 */
export function useSolana(): UseSolanaResult {
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [activeWalletAddress, setActiveWalletAddress] = useState<string | null>(
    null,
  );
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [detailedBalances, setDetailedBalances] = useState<
    Record<
      string,
      {
        balance: number;
        usdValue: number;
        lastUpdated: string;
        tokens: Array<{
          mint: string;
          symbol?: string;
          name?: string;
          balance: number;
          usdValue: number;
          decimals: number;
        }>;
      }
    >
  >({});
  const [availableWallets, setAvailableWallets] = useState<DetectedWalletApp[]>(
    [],
  );
  const [detectingWallets, setDetectingWallets] = useState(false);
  const setMissingTokenPrices = useWalletStore(
    (state) => state.setMissingTokenPrices,
  );

  const connection = useMemo(
    () => new Connection(HELIUS_RPC_URL, "confirmed"),
    [HELIUS_RPC_URL],
  );

  const refreshWalletDetection = useCallback(async () => {
    setDetectingWallets(true);
    try {
      const detectedWallets = await walletService.detectWallets();
      setAvailableWallets(detectedWallets);

      // Prefetch icons for detected wallets
      const walletIds = detectedWallets.map((wallet) => wallet.id);
      await iconService.prefetchWalletIcons(walletIds);

      return detectedWallets;
    } catch (error) {
      console.error("Error refreshing wallet detection:", error);
      return [];
    } finally {
      setDetectingWallets(false);
    }
  }, []);

  useEffect(() => {
    refreshWalletDetection().catch((error) => {
      console.warn("Wallet detection failed", error);
    });
  }, [refreshWalletDetection]);

  const activeWallet = useMemo(() => {
    if (!activeWalletAddress) {
      return linkedWallets[0] ?? null;
    }
    return (
      linkedWallets.find((wallet) => wallet.address === activeWalletAddress) ??
      null
    );
  }, [activeWalletAddress, linkedWallets]);

  const refreshBalance = useCallback(
    async (address?: string) => {
      const targetAddress = address ?? activeWallet?.address;
      if (!targetAddress) {
        return null;
      }
      try {
        const balance = await rpcService.getBalance(targetAddress);
        setBalances((prev) => ({ ...prev, [targetAddress]: balance }));

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
          const mints = tokensWithBalance.map((token) => token.mint);
          const [mintPrices, metadataMap] = await Promise.all([
            priceService.getTokenPricesInUsd(mints),
            tokenMetadataService.getMetadataMapForWallet(targetAddress, mints),
          ]);

          const missingPrices: string[] = [];
          tokenDetails = tokensWithBalance.map((token) => {
            const price = mintPrices[token.mint];
            if (price === undefined) {
              missingPrices.push(metadataMap[token.mint]?.symbol ?? token.mint);
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
          });

          const tokenUsdValue = tokenDetails.reduce(
            (sum, token) => sum + token.usdValue,
            0,
          );

          totalUsdValue = solBalance * solPrice + tokenUsdValue;
          setMissingTokenPrices(targetAddress, missingPrices);
        } catch (pricingError) {
          console.warn("Failed to aggregate token prices", pricingError);
          const solPrice = await priceService.getSolPriceInUsd().catch(() => 0);
          totalUsdValue = solBalance * solPrice;
        }

        setDetailedBalances((prev) => ({
          ...prev,
          [targetAddress]: {
            balance: solBalance,
            usdValue: Number(totalUsdValue.toFixed(2)),
            lastUpdated: now,
            tokens: tokenDetails,
          },
        }));
        return balance;
      } catch (error) {
        console.warn("Error refreshing balance", error);
        setBalances((prev) => {
          const next = { ...prev };
          delete next[targetAddress];
          return next;
        });
        setDetailedBalances((prev) => {
          const next = { ...prev };
          delete next[targetAddress];
          return next;
        });
        throw error;
      }
    },
    [activeWallet?.address, setMissingTokenPrices],
  );

  const normalizeAuthorization = useCallback(
    (
      authorization: AuthorizationResult,
      walletApp?: DetectedWalletApp,
    ): LinkedWallet[] => {
      return authorization.accounts.map(
        (accountFromWallet: { address: string; label?: string }) => ({
          address: decodeWalletAddress(accountFromWallet.address),
          label: accountFromWallet.label,
          authToken: authorization.auth_token,
          walletUriBase:
            authorization.wallet_uri_base ?? walletApp?.baseUri ?? null,
          walletAppId: walletApp?.id,
          walletName: walletApp?.name ?? accountFromWallet.label,
          icon: walletApp?.icon,
        }),
      );
    },
    [],
  );

  const upsertWallets = useCallback((nextWallets: LinkedWallet[]) => {
    setLinkedWallets((prev) => {
      const updated = [...prev];
      nextWallets.forEach((walletAccount) => {
        const existingIndex = updated.findIndex(
          (entry) => entry.address === walletAccount.address,
        );
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...walletAccount,
          };
        } else {
          updated.push(walletAccount);
        }
      });
      return updated;
    });
  }, []);

  const selectActiveWallet = useCallback((address: string) => {
    setActiveWalletAddress(address);
  }, []);

  useEffect(() => {
    if (activeWallet?.address) {
      refreshBalance(activeWallet.address).catch((err) => {
        console.warn("Balance refresh failed", err);
      });
    }
  }, [activeWallet?.address, refreshBalance]);

  const startAuthorization = useCallback(
    async (wallet?: DetectedWalletApp): Promise<AuthorizationPreview> => {
      try {
        return await walletService.startWalletAuthorization(wallet);
      } catch (error) {
        console.error("Wallet authorization failed", error);
        throw error;
      }
    },
    [],
  );

  const finalizeAuthorization = useCallback(
    async (preview: AuthorizationPreview, selectedAddresses?: string[]) => {
      try {
        const accountsToLink = await walletService.finalizeWalletAuthorization(
          preview,
          selectedAddresses,
        );

        upsertWallets(accountsToLink);
        setActiveWalletAddress(
          (current) => current ?? accountsToLink[0].address,
        );

        await Promise.all(
          accountsToLink.map((walletAccount) =>
            refreshBalance(walletAccount.address).catch((err) => {
              console.warn("Balance refresh failed post-connect", err);
            }),
          ),
        );

        return accountsToLink;
      } catch (error) {
        console.error("Error finalizing authorization:", error);
        throw error;
      }
    },
    [refreshBalance, upsertWallets],
  );

  const silentRefreshAuthorization = useCallback(
    async (address?: string) => {
      const targetAddress = address ?? activeWallet?.address;
      if (!targetAddress) {
        throw new Error("Select a wallet to refresh authorization");
      }

      const walletEntry = linkedWallets.find(
        (wallet) => wallet.address === targetAddress,
      );
      if (!walletEntry) {
        throw new Error("Wallet not linked");
      }

      const walletMetadata = walletEntry.walletAppId
        ? availableWallets.find(
            (wallet) => wallet.id === walletEntry.walletAppId,
          )
        : undefined;

      let reauthMethod: "silent" | "prompted" = "silent";

      try {
        const result = await transact(
          async (wallet: Web3MobileWallet) => {
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
              });
            }

            return { authorization, capabilities };
          },
          walletEntry.walletUriBase
            ? { baseUri: walletEntry.walletUriBase }
            : undefined,
        );

        const normalizedAccounts = normalizeAuthorization(
          result.authorization,
          walletMetadata,
        );
        upsertWallets(normalizedAccounts);

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
        throw error;
      }
    },
    [
      activeWallet?.address,
      availableWallets,
      linkedWallets,
      normalizeAuthorization,
      upsertWallets,
    ],
  );

  const disconnect = useCallback(
    async (address?: string) => {
      const targetAddress = address ?? activeWallet?.address;
      if (!targetAddress) return;

      const walletEntry = linkedWallets.find(
        (wallet) => wallet.address === targetAddress,
      );

      if (walletEntry) {
        const remainingWithToken = linkedWallets.filter(
          (wallet) =>
            wallet.authToken === walletEntry.authToken &&
            wallet.address !== targetAddress,
        );
        if (remainingWithToken.length === 0) {
          try {
            await transact(
              async (wallet) => {
                await wallet.deauthorize({ auth_token: walletEntry.authToken });
              },
              walletEntry.walletUriBase
                ? { baseUri: walletEntry.walletUriBase }
                : undefined,
            );
          } catch (error) {
            console.warn("Deauthorize failed (ignored)", error);
          }
        }
      }

      setLinkedWallets((prev) => {
        const next = prev.filter((wallet) => wallet.address !== targetAddress);
        setActiveWalletAddress((current) => {
          if (current && current !== targetAddress) {
            return current;
          }
          return next[0]?.address ?? null;
        });
        return next;
      });

      setBalances((prev) => {
        const { [targetAddress]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [activeWallet?.address, linkedWallets],
  );

  const sendSol = useCallback(
    async (
      recipientAddress: string,
      amountSol: number,
      options?: { fromAddress?: string },
    ) => {
      if (!recipientAddress) {
        throw new Error("Recipient address is required");
      }
      if (amountSol <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      const sourceAddress = options?.fromAddress ?? activeWallet?.address;
      if (!sourceAddress) {
        throw new Error("Select a wallet before sending");
      }

      const walletEntry = linkedWallets.find(
        (wallet) => wallet.address === sourceAddress,
      );
      if (!walletEntry) {
        throw new Error("Wallet not linked");
      }

      await requireBiometricApproval("Authenticate to send SOL");

      let senderPubkey: PublicKey;
      let recipientPubkey: PublicKey;
      try {
        senderPubkey = new PublicKey(sourceAddress);
      } catch (error) {
        throw new Error("Invalid source wallet address");
      }

      try {
        recipientPubkey = new PublicKey(recipientAddress);
      } catch (error) {
        throw new Error("Invalid recipient address");
      }

      const walletMetadata = walletEntry.walletAppId
        ? availableWallets.find(
            (wallet) => wallet.id === walletEntry.walletAppId,
          )
        : undefined;

      let reauthMethod: "silent" | "prompted" = "silent";
      let capabilityReport: WalletCapabilityReport = {
        ...DEFAULT_CAPABILITIES,
      };
      let refreshedAccount: LinkedWallet | null = null;
      const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
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

      await transact(
        async (wallet: Web3MobileWallet) => {
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
            });
          }

          const normalizedAccounts = normalizeAuthorization(
            authorization,
            walletMetadata,
          );
          upsertWallets(normalizedAccounts);

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
        },
        walletEntry.walletUriBase
          ? { baseUri: walletEntry.walletUriBase }
          : undefined,
      );

      if (!submittedSignature) {
        if (!fallbackSignedTransaction) {
          throw new Error("No signed transaction returned by wallet");
        }
        try {
          submittedSignature = await connection.sendRawTransaction(
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
        await connection.confirmTransaction(
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

      await refreshBalance(sourceAddress).catch((err) => {
        console.warn("Failed to refresh balance after send", err);
      });

      if (refreshedAccount) {
        const typedAccount = refreshedAccount as LinkedWallet;
        authorizationApi
          .recordSilentReauthorization({
            walletAddress: typedAccount.address,
            walletAppId: typedAccount.walletAppId ?? walletEntry.walletAppId,
            walletName: typedAccount.walletName ?? walletEntry.walletName,
            authToken: typedAccount.authToken,
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
            sourceWalletAddress: typedAccount.address,
            destinationAddress: recipientAddress,
            amountLamports: lamports,
            authorizationPrimitive: "silent-reauthorization",
            metadata: {
              walletAppId: typedAccount.walletAppId ?? "unknown",
              reauthorizationMethod: reauthMethod,
              capabilities: (capabilityReport.featureFlags || []).join(","),
            },
          })
          .catch((err) => {
            console.warn("Failed to record transaction audit", err);
          });
      }

      return submittedSignature;
    },
    [
      activeWallet?.address,
      availableWallets,
      connection,
      linkedWallets,
      refreshBalance,
      upsertWallets,
    ],
  );

  return {
    disconnect,
    sendSol,
    linkedWallets,
    activeWallet,
    selectActiveWallet,
    connection,
    isAuthenticated: linkedWallets.length > 0,
    balances,
    detailedBalances,
    refreshBalance,
    availableWallets,
    detectingWallets,
    refreshWalletDetection,
    startAuthorization,
    finalizeAuthorization,
    silentRefreshAuthorization,
  };
}
