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
   * Clears any stale wallet connection state before starting a new authorization.
   * This ensures that when adding a new wallet, there's no cached state from
   * a previous wallet that could interfere with the wallet chooser or authorization flow.
   *
   * Required for proper Solflare authorization: prevents state leakage from Phantom
   * that can cause Solflare's auth UI to not display properly.
   *
   * @private
   */
  private async clearWalletConnectionState(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log(
        "═══════════════════════════════════════════════════════════",
      );
      console.log(
        "[walletService] >>> START: Clearing wallet connection state",
      );
      console.log("[walletService] Timestamp:", new Date().toISOString());

      // Step 1: Log current state before clearing
      console.log("[walletService] Step 1: Checking current MWA state...");
      let capabilitiesResult: any = null;
      let capabilitiesError: any = null;

      try {
        const result = await transact(async (walletApi: Web3MobileWallet) => {
          console.log("[walletService]   - transact callback entered");
          console.log("[walletService]   - walletApi type:", typeof walletApi);
          console.log(
            "[walletService]   - walletApi methods:",
            Object.getOwnPropertyNames(Object.getPrototypeOf(walletApi)).filter(
              (m) => !m.startsWith("_"),
            ),
          );

          try {
            console.log("[walletService]   - Calling getCapabilities()...");
            const caps = await walletApi.getCapabilities();
            console.log("[walletService]   - getCapabilities() succeeded");
            console.log(
              "[walletService]   - Capabilities:",
              JSON.stringify(caps, null, 2),
            );
            return caps;
          } catch (error: any) {
            console.log(
              "[walletService]   - getCapabilities() failed:",
              error?.message || error,
            );
            capabilitiesError = error;
            return null;
          }
        });
        capabilitiesResult = result;
        console.log(
          "[walletService]   - transact completed, result:",
          result ? "has value" : "null",
        );
      } catch (transactError: any) {
        console.warn(
          "[walletService]   - transact() itself failed:",
          transactError?.message || transactError,
        );
        capabilitiesError = transactError;
      }

      // Step 2: Log the result of capability check
      if (capabilitiesResult) {
        console.log("[walletService] Step 2: ✓ Found active wallet session");
        console.log(
          "[walletService]   - Supports signAndSend:",
          capabilitiesResult.supports_sign_and_send_transactions,
        );
        console.log(
          "[walletService]   - Supports sign:",
          capabilitiesResult.supports_sign_transactions,
        );
      } else {
        console.log(
          "[walletService] Step 2: ✓ No active wallet session or session check failed",
        );
        if (capabilitiesError) {
          console.log(
            "[walletService]   - Error details:",
            capabilitiesError?.message || capabilitiesError,
          );
        }
      }

      // Step 3: Add delay to ensure state is fully cleared
      console.log(
        "[walletService] Step 3: Adding 200ms delay for state reset...",
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log("[walletService]   - Delay completed");

      const duration = Date.now() - startTime;
      console.log(
        "[walletService] >>> END: Wallet connection state cleared (took " +
          duration +
          "ms)",
      );
      console.log(
        "═══════════════════════════════════════════════════════════",
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.warn(
        "[walletService] >>> ERROR: Error clearing wallet state (non-critical, took " +
          duration +
          "ms)",
      );
      console.warn(
        "[walletService]   - Error type:",
        error?.constructor?.name || "Unknown",
      );
      console.warn(
        "[walletService]   - Error message:",
        error?.message || error,
      );
      console.warn("[walletService]   - Error stack:", error?.stack);
      console.warn(
        "[walletService]   - This is a cleanup operation, continuing anyway...",
      );
    }
  }

  /**
   * Initiates wallet authorization flow with biometric authentication.
   * This is the first step in connecting a wallet - it shows available wallets
   * and allows the user to select which accounts to authorize.
   *
   * The process:
   * 1. Clears any stale connection state from previous wallets
   * 2. Requires biometric approval for security
   * 3. Opens Mobile Wallet Adapter to select wallet app
   * 4. Authorizes the app to interact with selected wallets
   * 5. Returns a preview of available accounts
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
    const startTime = Date.now();
    try {
      console.log(
        "╔═══════════════════════════════════════════════════════════╗",
      );
      console.log("║ [walletService] >>> START: Wallet Authorization Flow");
      console.log(
        "╚═══════════════════════════════════════════════════════════╝",
      );
      console.log("[walletService] Timestamp:", new Date().toISOString());
      console.log("[walletService] Network:", this.network);
      console.log("[walletService] Identity:", APP_IDENTITY);

      // Step 1: Clear any stale connection state
      console.log("[walletService]");
      console.log(
        "[walletService] >>> Step 1: Clearing stale connection state...",
      );
      await this.clearWalletConnectionState();
      console.log("[walletService] >>> Step 1: Complete");

      // Step 2: Biometric approval
      console.log("[walletService]");
      console.log(
        "[walletService] >>> Step 2: Requesting biometric approval...",
      );
      const biometricStart = Date.now();
      await requireBiometricApproval("Authenticate to choose a wallet", {
        allowSessionReuse: true,
      });
      const biometricDuration = Date.now() - biometricStart;
      console.log(
        "[walletService] >>> Step 2: Biometric approval passed (took " +
          biometricDuration +
          "ms)",
      );

      // Step 3: MWA Authorization
      console.log("[walletService]");
      console.log("[walletService] >>> Step 3: Starting MWA authorization...");
      const mwaStart = Date.now();

      console.log("[walletService]   - Calling transact()...");
      const result = await transact(async (walletApi: Web3MobileWallet) => {
        console.log("[walletService]   - transact callback entered");
        console.log("[walletService]   - Preparing authorize request...");
        console.log(
          "[walletService]   - Identity:",
          JSON.stringify(APP_IDENTITY),
        );
        console.log("[walletService]   - Chain:", `solana:${this.network}`);
        console.log("[walletService]   - Features:", DEFAULT_FEATURES);

        console.log("[walletService]   - Calling walletApi.authorize()...");
        const authorization = await walletApi.authorize({
          identity: APP_IDENTITY,
          chain: `solana:${this.network}`,
          features: [...DEFAULT_FEATURES],
        });

        console.log("[walletService]   - authorize() completed");
        console.log("[walletService]   - Authorization result:");
        console.log(
          "[walletService]     • Accounts count:",
          authorization.accounts?.length || 0,
        );
        console.log(
          "[walletService]     • Auth token present:",
          !!authorization.auth_token,
        );
        console.log(
          "[walletService]     • Auth token (first 50 chars):",
          authorization.auth_token?.substring(0, 50) + "...",
        );
        if (authorization.accounts?.length > 0) {
          authorization.accounts.forEach((account, idx) => {
            console.log(`[walletService]     • Account ${idx + 1}:`, {
              address: account.address?.substring(0, 20) + "...",
              label: account.label,
            });
          });
        }
        if ((authorization as any).wallet_icon) {
          console.log("[walletService]     • Wallet icon present:", true);
        }

        return authorization;
      });

      const mwaDuration = Date.now() - mwaStart;
      console.log(
        "[walletService] >>> Step 3: MWA authorization complete (took " +
          mwaDuration +
          "ms)",
      );

      // Step 4: Normalize result
      console.log("[walletService]");
      console.log(
        "[walletService] >>> Step 4: Normalizing authorization result...",
      );
      const normalized = { accounts: this.normalizeAuthorization(result) };
      console.log(
        "[walletService]   - Normalized accounts:",
        normalized.accounts.map((a: any) => ({
          address: a.address?.substring(0, 20) + "...",
          label: a.label,
          hasAuthToken: !!a.authToken,
        })),
      );

      const totalDuration = Date.now() - startTime;
      console.log("[walletService]");
      console.log(
        "╔═══════════════════════════════════════════════════════════╗",
      );
      console.log("║ [walletService] >>> SUCCESS: Authorization completed");
      console.log("║ Total duration: " + totalDuration + "ms");
      console.log(
        "╚═══════════════════════════════════════════════════════════╝",
      );

      return normalized;
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(
        "╔═══════════════════════════════════════════════════════════╗",
      );
      console.error("║ [walletService] >>> ERROR: Authorization failed");
      console.error("║ Total duration: " + totalDuration + "ms");
      console.error(
        "╚═══════════════════════════════════════════════════════════╝",
      );
      console.error("[walletService] Error details:");
      console.error(
        "[walletService]   - Error type:",
        error?.constructor?.name || "Unknown",
      );
      console.error(
        "[walletService]   - Error message:",
        error?.message || error,
      );
      console.error("[walletService]   - Error code:", error?.code);
      console.error("[walletService]   - Error stack:", error?.stack);

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
      console.log("[walletService] Finalizing wallet authorization...");
      console.log("[walletService] Preview accounts:", preview.accounts);
      console.log("[walletService] Selected addresses:", selectedAddresses);

      const selection =
        selectedAddresses && selectedAddresses.length > 0
          ? new Set(selectedAddresses)
          : null;

      const accountsToLink = preview.accounts.filter((account) =>
        selection ? selection.has(account.address) : true,
      );
      console.log("[walletService] Accounts to link:", accountsToLink);

      if (accountsToLink.length === 0) {
        console.error("[walletService] No accounts selected to link");
        throw new Error("Select at least one account to continue");
      }

      console.log("[walletService] Finalize authorization successful");
      return accountsToLink;
    } catch (error) {
      console.error("[walletService] Error finalizing authorization:", error);
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
