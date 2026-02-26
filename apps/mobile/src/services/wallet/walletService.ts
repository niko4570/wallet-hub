import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../../config/env";
import { requireBiometricApproval } from "../../security/biometrics";
import { SecureStorageService } from "../storage/secureStorage.service";
import {
  decodeWalletAddress,
  handleStorageError,
  handleWalletError,
} from "../../utils";
import { LinkedWallet, AuthorizationPreview } from "../../types/wallet";
import { Buffer } from "buffer";

type Network = "mainnet-beta" | "devnet" | "testnet";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
  icon: "/favicon.ico",
};

const DEFAULT_FEATURES = [
  "solana:signAndSendTransactions",
  "solana:signTransactions",
  "solana:signMessages",
] as const;

/**
 * Wallet service for managing Solana wallet connections and operations.
 * Handles wallet authorization, signing, and reconnection using Mobile Wallet Adapter.
 *
 * This service provides:
 * - Wallet connection and authorization flow
 * - Message signing capabilities
 * - Wallet reconnection with cached auth tokens
 * - Secure storage of authorization tokens
 * - Network switching support
 */
class WalletService {
  private connection: Connection;
  private network: Network;

  constructor() {
    this.network = "mainnet-beta";
    this.connection = new Connection(SOLANA_RPC_URL, "confirmed");
  }

  /**
   * Set network and update connection.
   * Changes the active Solana network (mainnet-beta, devnet, or testnet).
   *
   * @param network - New network to connect to
   * @param connection - Optional new connection instance (uses default if not provided)
   *
   * @example
   * ```typescript
   * walletService.setNetwork("devnet");
   * walletService.setNetwork("mainnet-beta", new Connection("https://...", "confirmed"));
   * ```
   */
  setNetwork(network: Network, connection?: Connection): void {
    this.network = network;
    if (connection) {
      this.connection = connection;
    }
  }

  /**
   * Get current network.
   *
   * @returns The active network ("mainnet-beta", "devnet", or "testnet")
   */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Initiates wallet authorization flow with biometric authentication.
   * This is the first step in connecting a wallet - it shows available wallets
   * and allows the user to select which accounts to authorize.
   *
   * The process:
   * 1. Requires biometric approval for security
   * 2. Opens Mobile Wallet Adapter to select wallet app
   * 3. Authorizes the app to interact with selected wallets
   * 4. Returns a preview of available accounts
   *
   * @returns Promise resolving to authorization preview with available accounts
   * @throws {Error} If no compatible wallet found, user cancels, or authorization fails
   *
   * @example
   * ```typescript
   * try {
   *   const preview = await walletService.startWalletAuthorization();
   *   console.log("Available accounts:", preview.accounts);
   * } catch (error) {
   *   console.error("Authorization failed:", error);
   * }
   * ```
   */
  async startWalletAuthorization(): Promise<AuthorizationPreview> {
    try {
      await requireBiometricApproval("Authenticate to choose a wallet", {
        allowSessionReuse: true,
      });

      const result = await transact(async (walletApi: Web3MobileWallet) => {
        const authorization = await walletApi.authorize({
          identity: APP_IDENTITY,
          chain: `solana:${this.network}`,
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

  /**
   * Finalizes wallet authorization by selecting specific addresses.
   * This is the second step in connecting a wallet - it filters the available
   * accounts to only those the user wants to link.
   *
   * @param preview - The authorization preview from startWalletAuthorization
   * @param selectedAddresses - Optional array of specific addresses to link (links all if not provided)
   * @returns Promise resolving to array of linked wallets
   * @throws {Error} If no addresses are selected
   *
   * @example
   * ```typescript
   * const preview = await walletService.startWalletAuthorization();
   * const linkedWallets = await walletService.finalizeWalletAuthorization(
   *   preview,
   *   ["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"]
   * );
   * ```
   */
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

  /**
   * Signs a message using the connected wallet.
   * This is used for authentication and verification purposes.
   *
   * @param wallet - The linked wallet to sign with
   * @param payload - The message payload to sign (as Uint8Array)
   * @returns Promise resolving to the signature as Uint8Array
   * @throws {Error} If wallet does not return a signature
   *
   * @example
   * ```typescript
   * const message = new TextEncoder().encode("Hello, World!");
   * const signature = await walletService.signMessage(wallet, message);
   * console.log("Signature:", Buffer.from(signature).toString("hex"));
   * ```
   */
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
            chain: `solana:${this.network}`,
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

  /**
   * Gets the SOL balance for a wallet address.
   *
   * @param address - The wallet address to check
   * @returns Promise resolving to balance in lamports
   * @throws {Error} If fetching balance fails
   *
   * @example
   * ```typescript
   * const balance = await walletService.getWalletBalance("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * console.log(`Balance: ${balance} lamports`);
   * ```
   */
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

  /**
   * Normalizes authorization result to linked wallet format.
   * Converts the raw authorization response to a standardized LinkedWallet structure.
   *
   * @param authorization - The authorization result from Mobile Wallet Adapter
   * @returns Array of linked wallets
   */
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

  /**
   * Normalizes single authorization result to linked wallet format.
   *
   * @param authorization - The authorization result from Mobile Wallet Adapter
   * @returns Single linked wallet
   */
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
   * Connects to a wallet using Mobile Wallet Adapter.
   * This is a convenience method that combines startWalletAuthorization
   * and finalizeWalletAuthorization into a single flow.
   *
   * @returns Promise resolving to array of linked wallets
   * @throws {Error} If authorization fails
   *
   * @example
   * ```typescript
   * const wallets = await walletService.connectWallet();
   * console.log("Connected wallets:", wallets);
   * ```
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
   * Reconnects to a wallet using cached auth token.
   * This allows the app to reconnect to a previously authorized wallet
   * without requiring user interaction.
   *
   * @param walletAddress - The wallet address to reconnect
   * @returns Promise resolving to reconnected wallet, or null if failed
   *
   * @example
   * ```typescript
   * const wallet = await walletService.reconnectWallet("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * if (wallet) {
   *   console.log("Reconnected to:", wallet.address);
   * }
   * ```
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
   * Disconnects from a wallet and revokes authorization.
   * This removes the wallet's authorization token and clears cached data.
   *
   * @param wallet - The linked wallet to disconnect
   *
   * @example
   * ```typescript
   * await walletService.disconnectWallet(wallet);
   * console.log("Wallet disconnected");
   * ```
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
   * Handles wallet errors with proper error messages.
   *
   * @param error - The error object to handle
   */
  private handleWalletError(error: unknown): void {
    handleWalletError(error);
  }

  /**
   * Stores auth tokens securely for all connected wallets.
   * Uses SecureStorageService to persist tokens in encrypted storage.
   *
   * @param wallets - Array of linked wallets to store tokens for
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
   * Gets cached auth token for a wallet.
   *
   * @param walletAddress - The wallet address to get token for
   * @returns Promise resolving to auth token string, or null if not found
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
   * Checks if a wallet is already connected.
   *
   * @param walletAddress - The wallet address to check
   * @returns Promise resolving to true if wallet has a cached auth token
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
   * Refreshes wallet authorization.
   * Attempts to reauthorize using existing token, or falls back to full authorization.
   *
   * @param wallet - The linked wallet to refresh
   * @returns Promise resolving to refreshed wallet, or null if failed
   *
   * @example
   * ```typescript
   * const refreshed = await walletService.refreshAuthorization(wallet);
   * if (refreshed) {
   *   console.log("Authorization refreshed");
   * }
   * ```
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
              chain: `solana:${this.network}`,
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
   * Gets wallet capabilities from Mobile Wallet Adapter.
   * Returns the features and capabilities supported by the connected wallet.
   *
   * @param wallet - The linked wallet to check
   * @returns Promise resolving to wallet capabilities object, or null if failed
   *
   * @example
   * ```typescript
   * const capabilities = await walletService.getWalletCapabilities(wallet);
   * console.log("Supported features:", capabilities);
   * ```
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
