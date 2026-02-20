import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Connection, PublicKey } from "@solana/web3.js";
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";
import { SecureStorageService } from "./secureStorage.service";
import { decodeWalletAddress } from "../utils/solanaAddress";
import { handleWalletError, handleStorageError } from "../utils/errorHandler";
import { LinkedWallet, AuthorizationPreview } from "../types/wallet";
import { Buffer } from "buffer";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
  icon: "https://wallethub.app/favicon.ico",
};

const DEFAULT_FEATURES = [
  "solana:signAndSendTransactions",
  "solana:signTransactions",
  "solana:signMessages",
] as const;

class WalletService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(HELIUS_RPC_URL, "confirmed");
  }

  async startWalletAuthorization(): Promise<AuthorizationPreview> {
    try {
      await requireBiometricApproval("Authenticate to choose a wallet", {
        allowSessionReuse: true,
      });

      const result = await transact(async (walletApi: Web3MobileWallet) => {
        const authorization = await walletApi.authorize({
          identity: APP_IDENTITY,
          chain: SOLANA_CLUSTER,
          features: [...DEFAULT_FEATURES],
        });

        return authorization;
      });

      return { accounts: this.normalizeAuthorization(result) };
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
  ): LinkedWallet[] {
    return authorization.accounts.map((accountFromWallet) => ({
      address: decodeWalletAddress(accountFromWallet.address),
      label: accountFromWallet.label,
      authToken: authorization.auth_token,
      walletName: accountFromWallet.label,
      icon: (authorization as any).wallet_icon,
    }));
  }

  private normalizeSingleAuthorization(
    authorization: AuthorizationResult,
  ): LinkedWallet {
    const account = authorization.accounts[0];
    return {
      address: decodeWalletAddress(account.address),
      label: account.label,
      authToken: authorization.auth_token,
      walletName: account.label,
      icon: (authorization as any).wallet_icon,
    };
  }

  /**
   * Connect to a wallet using MWA with proper error handling
   */
  async connectWallet(): Promise<LinkedWallet[]> {
    try {
      const preview = await this.startWalletAuthorization();
      const accounts = await this.finalizeWalletAuthorization(preview);

      // Store auth tokens securely
      await this.storeAuthTokens(accounts);

      return accounts;
    } catch (error) {
      this.handleWalletError(error);
      throw error;
    }
  }

  /**
   * Reconnect to a wallet using cached auth token
   * @param walletAddress Wallet address to reconnect
   * @returns Reconnected wallet or null if failed
   */
  async reconnectWallet(walletAddress: string): Promise<LinkedWallet | null> {
    try {
      const authToken = await this.getCachedAuthToken(walletAddress);
      if (!authToken) {
        return null;
      }

      const result = await transact(async (wallet: Web3MobileWallet) => {
        try {
          const authorization = await wallet.reauthorize({
            identity: APP_IDENTITY,
            auth_token: authToken,
          });

          return this.normalizeSingleAuthorization(authorization);
        } catch (error) {
          console.warn(
            "Reauthorization failed, falling back to authorize",
            error,
          );
          return null;
        }
      });

      if (result) {
        // Store updated auth token
        await SecureStorageService.storeWalletData(
          walletAddress,
          "authToken",
          result.authToken,
        );
        return result;
      }

      return null;
    } catch (error) {
      console.warn("Wallet reconnection failed", error);
      return null;
    }
  }

  /**
   * Disconnect from a wallet
   * @param wallet Wallet to disconnect
   */
  async disconnectWallet(wallet: LinkedWallet): Promise<void> {
    try {
      if (wallet.authToken) {
        try {
          await transact(async (walletInstance: Web3MobileWallet) => {
            await walletInstance.deauthorize({
              auth_token: wallet.authToken,
            });
          });
        } catch (error) {
          console.warn("Deauthorization failed (ignored)", error);
        }
      }

      // Clear stored auth token
      await SecureStorageService.removeWalletData(wallet.address, "authToken");
    } catch (error) {
      console.error("Wallet disconnection error", error);
    }
  }

  /**
   * Handle wallet errors with proper error messages
   * @param error Error object
   */
  private handleWalletError(error: unknown): void {
    handleWalletError(error);
  }

  /**
   * Store auth tokens securely for all connected wallets
   * @param wallets Array of linked wallets
   */
  private async storeAuthTokens(wallets: LinkedWallet[]): Promise<void> {
    for (const wallet of wallets) {
      if (wallet.authToken) {
        try {
          await SecureStorageService.storeWalletData(
            wallet.address,
            "authToken",
            wallet.authToken,
          );
        } catch (error) {
          handleStorageError(error);
        }
      }
    }
  }

  /**
   * Get cached auth token for a wallet
   * @param walletAddress Wallet address
   * @returns Auth token or null if not found
   */
  async getCachedAuthToken(walletAddress: string): Promise<string | null> {
    try {
      return await SecureStorageService.getWalletData(
        walletAddress,
        "authToken",
      );
    } catch (error) {
      handleStorageError(error);
      return null;
    }
  }

  /**
   * Check if a wallet is already connected
   * @param walletAddress Wallet address to check
   * @returns True if wallet is connected
   */
  async isWalletConnected(walletAddress: string): Promise<boolean> {
    try {
      const authToken = await this.getCachedAuthToken(walletAddress);
      return !!authToken;
    } catch (error) {
      handleStorageError(error);
      return false;
    }
  }

  /**
   * Refresh wallet authorization
   * @param wallet Linked wallet to refresh
   * @returns Refreshed wallet or null if failed
   */
  async refreshAuthorization(
    wallet: LinkedWallet,
  ): Promise<LinkedWallet | null> {
    try {
      const result = await transact(
        async (walletInstance: Web3MobileWallet) => {
          let authorization: AuthorizationResult | null = null;

          if (wallet.authToken) {
            try {
              authorization = await walletInstance.reauthorize({
                identity: APP_IDENTITY,
                auth_token: wallet.authToken,
              });
            } catch (error) {
              console.warn(
                "Reauthorization failed, falling back to authorize",
                error,
              );
            }
          }

          if (!authorization) {
            authorization = await walletInstance.authorize({
              identity: APP_IDENTITY,
              chain: SOLANA_CLUSTER,
              features: [...DEFAULT_FEATURES],
            });
          }

          return this.normalizeSingleAuthorization(authorization);
        },
      );

      if (result) {
        // Update stored auth token
        await SecureStorageService.storeWalletData(
          result.address,
          "authToken",
          result.authToken,
        );
        return result;
      }

      return null;
    } catch (error) {
      console.warn("Authorization refresh failed", error);
      return null;
    }
  }

  /**
   * Get wallet capabilities
   * @param wallet Linked wallet to check
   * @returns Wallet capabilities or null if failed
   */
  async getWalletCapabilities(wallet: LinkedWallet): Promise<any | null> {
    try {
      const result = await transact(
        async (walletInstance: Web3MobileWallet) => {
          return await walletInstance.getCapabilities();
        },
      );

      return result;
    } catch (error) {
      console.warn("Failed to get wallet capabilities", error);
      return null;
    }
  }
}

export const walletService = new WalletService();
