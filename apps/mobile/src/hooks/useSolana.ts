import { useCallback, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import { Linking } from "react-native";
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
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
};

interface WalletCatalogEntry {
  id: string;
  name: string;
  icon: string;
  scheme?: string;
  baseUri?: string;
  publisher?: string;
  subtitle?: string;
}

export interface DetectedWalletApp extends WalletCatalogEntry {
  installed: boolean;
  detectionMethod: "scheme" | "fallback" | "error";
}

const WALLET_DIRECTORY: WalletCatalogEntry[] = [
  {
    id: "phantom",
    name: "Phantom",
    icon: "🟣",
    scheme: "phantom://",
    baseUri: "https://phantom.app/ul/v1/wallet/adapter",
    subtitle: "Fast, secure & popular",
  },
  {
    id: "solflare",
    name: "Solflare",
    icon: "🟠",
    scheme: "solflare://",
    baseUri: "https://solflare.com/ul/v1/wallet/adapter",
    subtitle: "DeFi focused wallet",
  },
  {
    id: "backpack",
    name: "Backpack",
    icon: "🧳",
    scheme: "backpack://",
    baseUri: "https://backpack.app/ul/v1/wallet/adapter",
    subtitle: "xNFT capable",
  },
  {
    id: "glow",
    name: "Glow",
    icon: "✨",
    scheme: "glow://",
    baseUri: "https://glow.app/ul/v1/wallet/adapter",
    subtitle: "Simple & social",
  },
  {
    id: "tiplink",
    name: "TipLink",
    icon: "🔗",
    scheme: "tiplink://",
    baseUri: "https://tiplink.io/ul/v1/wallet/adapter",
    subtitle: "Link-based wallet",
  },
];

interface AccountMeta {
  address: string;
  label?: string;
}

export interface LinkedWallet extends AccountMeta {
  authToken: string;
  walletUriBase?: string | null;
  walletAppId?: string;
  walletName?: string;
  icon?: string;
}

export interface AuthorizationPreview {
  walletApp?: DetectedWalletApp;
  accounts: LinkedWallet[];
}

/**
 * Normalize wallet addresses emitted from Mobile Wallet Adapter.
 * Some wallets return base64-encoded 32 byte buffers, others return base58 strings.
 */
const decodeWalletAddress = (rawAddress: string): string => {
  const trimmed = rawAddress.trim();
  const attempts: Error[] = [];

  const tryPublicKey = (input: Buffer | string) => {
    const pubkey = new PublicKey(input);
    return pubkey.toBase58();
  };

  try {
    const asBase64 = Buffer.from(trimmed, "base64");
    if (asBase64.length === 32) {
      return tryPublicKey(asBase64);
    }
  } catch (error) {
    attempts.push(error as Error);
  }

  try {
    return tryPublicKey(trimmed);
  } catch (error) {
    attempts.push(error as Error);
    console.error("Wallet provided invalid address", attempts);
    throw new Error("Wallet returned an invalid address.");
  }
};

interface UseSolanaResult {
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
  const [availableWallets, setAvailableWallets] = useState<DetectedWalletApp[]>(
    [],
  );
  const [detectingWallets, setDetectingWallets] = useState(false);

  const connection = useMemo(
    () => new Connection(HELIUS_RPC_URL, "confirmed"),
    [HELIUS_RPC_URL],
  );

  const refreshWalletDetection = useCallback(async () => {
    setDetectingWallets(true);
    try {
      const results = await Promise.all(
        WALLET_DIRECTORY.map<Promise<DetectedWalletApp>>(async (wallet) => {
          if (!wallet.scheme) {
            return { ...wallet, installed: true, detectionMethod: "fallback" };
          }
          try {
            const canOpen = await Linking.canOpenURL(wallet.scheme);
            return {
              ...wallet,
              installed: canOpen,
              detectionMethod: "scheme",
            };
          } catch (error) {
            console.warn(`Wallet detection failed for ${wallet.name}`, error);
            return { ...wallet, installed: false, detectionMethod: "error" };
          }
        }),
      );

      if (!results.some((wallet) => wallet.installed)) {
        results.push({
          id: "system-picker",
          name: "Any compatible wallet",
          icon: "🌐",
          installed: true,
          detectionMethod: "fallback",
        });
      }

      setAvailableWallets(results);
      return results;
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
      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(targetAddress);
      } catch (error) {
        console.warn("Invalid account address when refreshing balance", error);
        setBalances((prev) => {
          const next = { ...prev };
          delete next[targetAddress];
          return next;
        });
        throw error;
      }
      const balance = await connection.getBalance(publicKey);
      setBalances((prev) => ({ ...prev, [targetAddress]: balance }));
      return balance;
    },
    [activeWallet?.address, connection],
  );

  const normalizeAuthorization = useCallback(
    (authorization: AuthorizationResult, walletApp?: DetectedWalletApp) => {
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
        await requireBiometricApproval("Authenticate to choose a wallet");
        // For installed wallets, don't pass baseUri - let the system handle it
        // Only pass baseUri for fallback wallets or when wallet is not installed
        const transactOptions =
          wallet?.installed === false && wallet.baseUri
            ? { baseUri: wallet.baseUri }
            : undefined;

        const authorization = await transact(
          async (walletApi: Web3MobileWallet) => {
            return walletApi.authorize({
              identity: APP_IDENTITY,
              chain: SOLANA_CLUSTER,
            });
          },
          transactOptions,
        );
        const normalized = normalizeAuthorization(authorization, wallet);
        return { walletApp: wallet, accounts: normalized };
      } catch (error) {
        console.error("Wallet authorization failed", error);
        throw error;
      }
    },
    [normalizeAuthorization],
  );

  const finalizeAuthorization = useCallback(
    async (preview: AuthorizationPreview, selectedAddresses?: string[]) => {
      const selection =
        selectedAddresses && selectedAddresses.length > 0
          ? new Set(selectedAddresses)
          : null;

      const accountsToLink = preview.accounts.filter((account) =>
        selection ? selection.has(account.address) : true,
      );

      if (accountsToLink.length === 0) {
        throw new Error("Select at least one account to continue");
      }

      upsertWallets(accountsToLink);
      setActiveWalletAddress((current) => current ?? accountsToLink[0].address);

      await Promise.all(
        accountsToLink.map((walletAccount) =>
          refreshBalance(walletAccount.address).catch((err) => {
            console.warn("Balance refresh failed post-connect", err);
          }),
        ),
      );

      return accountsToLink;
    },
    [refreshBalance, upsertWallets],
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

      const walletMetadata = walletEntry.walletAppId
        ? availableWallets.find(
            (wallet) => wallet.id === walletEntry.walletAppId,
          )
        : undefined;

      const signature = await transact(
        async (wallet: Web3MobileWallet) => {
          let authorization: AuthorizationResult;
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

          const primaryAccount =
            normalizedAccounts.find(
              (account: LinkedWallet) => account.address === sourceAddress,
            ) ?? normalizedAccounts[0];

          if (!primaryAccount) {
            throw new Error("Wallet did not return the requested account");
          }

          const senderPubkey = new PublicKey(primaryAccount.address);
          const recipientPubkey = new PublicKey(recipientAddress);

          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash();
          const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
          const transaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          }).add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipientPubkey,
              lamports,
            }),
          );

          const [signature] = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });
          return signature;
        },
        walletEntry.walletUriBase
          ? { baseUri: walletEntry.walletUriBase }
          : undefined,
      );

      await refreshBalance(sourceAddress).catch((err) => {
        console.warn("Failed to refresh balance after send", err);
      });

      return signature;
    },
    [
      activeWallet?.address,
      availableWallets,
      connection,
      linkedWallets,
      normalizeAuthorization,
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
    refreshBalance,
    availableWallets,
    detectingWallets,
    refreshWalletDetection,
    startAuthorization,
    finalizeAuthorization,
  };
}
