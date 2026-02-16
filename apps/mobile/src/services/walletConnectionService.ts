import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  SolanaMobileWalletAdapterError,
  SolanaMobileWalletAdapterErrorCode,
  SolanaMobileWalletAdapterProtocolError,
} from "@solana-mobile/mobile-wallet-adapter-protocol";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { walletService } from "./walletService";
import { SecureStorageService } from "./secureStorageService";
import { decodeWalletAddress } from "../utils/solanaAddress";
import { SOLANA_CLUSTER } from "../config/env";
import { LinkedWallet } from "../types/wallet";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
  icon: "https://wallethub.app/favicon.ico",
};

class WalletConnectionService {
  private static instance: WalletConnectionService;

  private constructor() {}

  static getInstance(): WalletConnectionService {
    if (!WalletConnectionService.instance) {
      WalletConnectionService.instance = new WalletConnectionService();
    }
    return WalletConnectionService.instance;
  }

  /**
   * Connect to a wallet using MWA with proper error handling
   */
  async connectWallet(): Promise<LinkedWallet[]> {
    try {
      const preview = await walletService.startWalletAuthorization();
      const accounts = await walletService.finalizeWalletAuthorization(preview);

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
      const authToken = await SecureStorageService.getWalletData(
        walletAddress,
        "authToken",
      );
      if (!authToken) {
        return null;
      }

      const result = await transact(async (wallet: Web3MobileWallet) => {
        try {
          const authorization = await wallet.reauthorize({
            identity: APP_IDENTITY,
            auth_token: authToken,
          });

          return this.normalizeAuthorization(authorization);
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
    if (error instanceof SolanaMobileWalletAdapterError) {
      switch (error.code) {
        case SolanaMobileWalletAdapterErrorCode.ERROR_SECURE_CONTEXT_REQUIRED:
          console.error("MWA requires HTTPS");
          break;
        case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT:
          console.error("Wallet connection timed out");
          break;
        case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED:
          console.error("Wallet session closed unexpectedly");
          break;
        case SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND:
          console.error("No compatible wallet found");
          break;
      }
    } else if (error instanceof Error) {
      console.error("Wallet error:", error.message);
    } else {
      console.error("Unknown wallet error:", error);
    }
  }

  /**
   * Normalize authorization result to LinkedWallet format
   * @param authorization Authorization result from wallet
   * @returns Normalized LinkedWallet
   */
  private normalizeAuthorization(
    authorization: AuthorizationResult,
  ): LinkedWallet {
    const account = authorization.accounts[0];
    return {
      address: decodeWalletAddress(account.address),
      label: account.label,
      authToken: authorization.auth_token,
      walletName: account.label,
    };
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
          console.warn("Failed to store auth token", error);
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
      console.warn("Failed to get cached auth token", error);
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
      console.warn("Failed to check wallet connection status", error);
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
      const result = await transact(async (walletInstance: Web3MobileWallet) => {
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
          });
        }

        return this.normalizeAuthorization(authorization);
      });

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
      const result = await transact(async (walletInstance: Web3MobileWallet) => {
        return await walletInstance.getCapabilities();
      });

      return result;
    } catch (error) {
      console.warn("Failed to get wallet capabilities", error);
      return null;
    }
  }
}

// Create and export singleton instance
export const walletConnectionService = WalletConnectionService.getInstance();
