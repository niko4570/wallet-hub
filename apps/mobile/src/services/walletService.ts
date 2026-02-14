import { Linking } from "react-native";
import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Connection, PublicKey } from "@solana/web3.js";
import { WALLET_DIRECTORY } from "../config/wallets";
import { HELIUS_RPC_URL } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";
import { decodeWalletAddress } from "../utils/solanaAddress";
import {
  DetectedWalletApp,
  LinkedWallet,
  AuthorizationPreview,
} from "../types/wallet";

class WalletService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(HELIUS_RPC_URL, "confirmed");
  }

  async detectWallets(): Promise<DetectedWalletApp[]> {
    try {
      const detectedWallets: DetectedWalletApp[] = await Promise.all(
        WALLET_DIRECTORY.map(async (wallet) => {
          if (!wallet.scheme) {
            return {
              ...wallet,
              installed: true,
              detectionMethod: "fallback",
            };
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
            return {
              ...wallet,
              installed: false,
              detectionMethod: "error",
            };
          }
        }),
      );

      // Add fallback if no wallets detected
      if (!detectedWallets.some((wallet) => wallet.installed)) {
        detectedWallets.push({
          id: "system-picker",
          name: "Any compatible wallet",
          icon: "🌐",
          installed: true,
          detectionMethod: "fallback",
        });
      }

      return detectedWallets;
    } catch (error) {
      console.error("Error detecting wallets:", error);
      return [];
    }
  }

  /**
   * Get the first installed wallet app
   * @returns The first installed wallet app or null if none found
   */
  async getFirstInstalledWallet(): Promise<DetectedWalletApp | null> {
    try {
      const detectedWallets = await this.detectWallets();
      return (
        detectedWallets.find(
          (wallet) => wallet.installed && wallet.id !== "system-picker",
        ) || null
      );
    } catch (error) {
      console.error("Error getting first installed wallet:", error);
      return null;
    }
  }

  /**
   * Start wallet authorization with auto-detection of installed wallet
   * @returns Authorization preview
   */
  async startWalletAuthorizationWithAutoDetect(): Promise<AuthorizationPreview> {
    try {
      await requireBiometricApproval("Authenticate to connect wallet", {
        allowSessionReuse: true,
      });

      const installedWallet = await this.getFirstInstalledWallet();
      if (!installedWallet) {
        throw new Error(
          "No compatible wallet found. Please install a Solana wallet app.",
        );
      }

      console.log("Auto-detected wallet:", installedWallet.name);
      return await this.startWalletAuthorization(installedWallet);
    } catch (error) {
      console.error("Auto-detect wallet authorization failed:", error);
      throw error;
    }
  }

  async startWalletAuthorization(
    wallet?: DetectedWalletApp,
  ): Promise<AuthorizationPreview> {
    try {
      await requireBiometricApproval("Authenticate to choose a wallet", {
        allowSessionReuse: true,
      });

      const walletBaseUri = wallet?.baseUri;
      const preferRemoteAssociation =
        walletBaseUri != null && walletBaseUri.startsWith("https://");
      const localAssociationUri =
        wallet?.scheme && !wallet.scheme.startsWith("http")
          ? wallet.scheme
          : undefined;

      const runAuthorization = async (options?: {
        baseUri: string;
      }): Promise<AuthorizationPreview> => {
        console.log("Starting authorization with wallet:", wallet?.name);
        console.log("Wallet installed:", wallet?.installed);
        console.log("Using transactOptions:", options);
        console.log("Wallet scheme:", wallet?.scheme);

        const result = await transact(async (walletApi: Web3MobileWallet) => {
          const authorization = await walletApi.authorize({
            identity: {
              name: "WalletHub",
              uri: "https://wallethub.app",
            },
            chain: "solana:mainnet-beta",
            addresses: undefined,
          });

          return { authorization };
        }, options);

        console.log(
          "Authorization result accounts:",
          result.authorization.accounts,
        );
        console.log(
          "Number of accounts returned:",
          result.authorization.accounts.length,
        );

        const normalized = this.normalizeAuthorization(
          result.authorization,
          wallet,
        );

        console.log("Normalized accounts:", normalized);
        return { walletApp: wallet, accounts: normalized };
      };

      if (preferRemoteAssociation) {
        try {
          return await runAuthorization({ baseUri: walletBaseUri! });
        } catch (error) {
          if (this.shouldRetryWithLocalAssociation(error)) {
            console.warn(
              "Remote association failed, retrying with local scheme...",
              error,
            );
          } else {
            throw error;
          }
        }
      } else if (wallet?.installed && !walletBaseUri && !localAssociationUri) {
        console.warn(
          `No valid baseUri for installed wallet ${wallet.name}, may fallback to system chooser`,
        );
      }

      if (localAssociationUri) {
        return await runAuthorization({ baseUri: localAssociationUri });
      }

      return await runAuthorization();
    } catch (error: any) {
      console.error("Wallet authorization failed:", error);

      // Handle specific error types
      if (error.code === "ERR_WALLET_NOT_FOUND") {
        throw new Error(
          "No compatible wallet found. Please install a Solana wallet app.",
        );
      } else if (error.code === "ERR_USER_CANCELLED") {
        throw new Error("Authorization cancelled by user");
      } else if (error.message?.includes("authorization")) {
        throw new Error("Failed to authorize wallet. Please try again.");
      }

      throw error;
    }
  }

  async finalizeWalletAuthorization(
    preview: AuthorizationPreview,
    selectedAddresses?: string[],
  ): Promise<LinkedWallet[]> {
    try {
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

      return accountsToLink;
    } catch (error) {
      console.error("Error finalizing authorization:", error);
      throw error;
    }
  }

  async signMessage(
    wallet: LinkedWallet,
    payload: Uint8Array,
  ): Promise<Uint8Array> {
    const addressBase64 = Buffer.from(
      new PublicKey(wallet.address).toBytes(),
    ).toString("base64");

    try {
      const signedPayloads = await transact(
        async (walletApi: Web3MobileWallet) => {
          await walletApi.authorize({
            identity: {
              name: "WalletHub",
              uri: "https://wallethub.app",
            },
            chain: "solana:mainnet-beta",
            auth_token: wallet.authToken,
          });

          return walletApi.signMessages({
            addresses: [addressBase64],
            payloads: [payload],
            auth_token: wallet.authToken,
          } as any);
        },
        wallet.walletUriBase ? { baseUri: wallet.walletUriBase } : undefined,
      );

      const [signature] = signedPayloads ?? [];
      if (!signature) {
        throw new Error("Wallet did not return a signature.");
      }

      return signature;
    } catch (error) {
      console.error("Error signing message with wallet:", error);
      throw error;
    }
  }

  async getWalletBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance;
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      throw error;
    }
  }

  private normalizeAuthorization(
    authorization: AuthorizationResult,
    walletApp?: DetectedWalletApp,
  ): LinkedWallet[] {
    // Only use wallet_uri_base if it's HTTPS, otherwise use the configured baseUri
    let walletUriBase = null;
    if (
      authorization.wallet_uri_base &&
      authorization.wallet_uri_base.startsWith("https://")
    ) {
      walletUriBase = authorization.wallet_uri_base;
    } else if (walletApp?.baseUri && walletApp.baseUri.startsWith("https://")) {
      walletUriBase = walletApp.baseUri;
    }

    return authorization.accounts.map((accountFromWallet) => ({
      address: decodeWalletAddress(accountFromWallet.address),
      label: accountFromWallet.label,
      authToken: authorization.auth_token,
      walletUriBase: walletUriBase,
      walletAppId: walletApp?.id,
      walletName: walletApp?.name ?? accountFromWallet.label,
      icon: (authorization as any).wallet_icon ?? walletApp?.icon,
    }));
  }

  async refreshWalletRegistry(): Promise<void> {
    try {
      // This would fetch the latest wallet registry from the API
      // For now, we'll use the local directory
      console.log("Refreshing wallet registry...");
    } catch (error) {
      console.error("Error refreshing wallet registry:", error);
    }
  }

  private shouldRetryWithLocalAssociation(error: unknown): boolean {
    if (!error) {
      return false;
    }
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : ((error as any)?.toString?.() ?? "");
    const normalizedMessage = String(message ?? "");
    const code = (error as any)?.code ?? (error as any)?.name;

    return (
      normalizedMessage.includes("Local association cancelled") ||
      normalizedMessage.includes("Local association canceled") ||
      code === "ERR_LOCAL_ASSOCIATION_CANCELED" ||
      code === "ERR_LOCAL_ASSOCIATION_CANCELLED"
    );
  }
}

export const walletService = new WalletService();
