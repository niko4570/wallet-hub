import { useCallback, useMemo } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { useMultiWalletStore } from "../store/multiWalletStore";
import {
  WalletSession,
  WalletAssociationConfig,
  AddWalletResult,
  UseMultiWalletManagerReturn,
  SignTransactionOptions,
} from "../types/multiWallet";
import { SOLANA_CLUSTER } from "../config/env";
import { decodeWalletAddress } from "../utils";
import { requireBiometricApproval } from "../security/biometrics";

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
 * Custom hook for managing multiple independent wallet sessions.
 * Each call to addWallet() establishes a completely new session with the wallet,
 * allowing users to connect multiple wallets (Phantom, Solflare, Backpack, etc.) simultaneously.
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const {
 *     sessions,
 *     activeSession,
 *     addWallet,
 *     removeWallet,
 *     setActiveWallet,
 *     signTransaction,
 *   } = useMultiWalletManager();
 *
 *   const handleAddWallet = async () => {
 *     try {
 *       const result = await addWallet({ label: "Phantom 1" });
 *       console.log("Added wallet:", result.session);
 *     } catch (error) {
 *       console.error("Failed to add wallet:", error);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       <Button title="Add Wallet" onPress={handleAddWallet} />
 *       {sessions.map(session => (
 *         <Text key={session.sessionId}>{session.label}</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useMultiWalletManager(): UseMultiWalletManagerReturn {
  const store = useMultiWalletStore();

  /**
   * Normalize authorization result to WalletSession format.
   */
  const normalizeAuthorization = useCallback(
    (
      authorization: AuthorizationResult,
      sessionId: string,
      label?: string,
      walletIcon?: string,
    ): WalletSession[] => {
      return authorization.accounts.map((account) => ({
        sessionId,
        address: decodeWalletAddress(account.address),
        label: label || account.label || "Wallet",
        authToken: authorization.auth_token,
        walletName: account.label,
        icon: walletIcon || (authorization as any).wallet_icon,
        isActive: false,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        status: "connected" as const,
      }));
    },
    [],
  );

  /**
   * Add a new wallet session.
   * This is the core function that establishes a completely independent session
   * with a wallet app using the MWA transact API.
   *
   * @param config - Optional configuration including custom label
   * @returns Promise resolving to the added wallet session
   */
  const addWallet = useCallback(
    async (config?: WalletAssociationConfig): Promise<AddWalletResult> => {
      const startTime = Date.now();
      console.log(
        "╔═══════════════════════════════════════════════════════════╗",
      );
      console.log(
        "║ [useMultiWalletManager] >>> START: Adding new wallet session",
      );
      console.log(
        "╚═══════════════════════════════════════════════════════════╝",
      );
      console.log("[addWallet] Timestamp:", new Date().toISOString());
      console.log("[addWallet] Config:", config);

      try {
        // Step 1: Generate unique session ID
        const sessionId = store.generateSessionId();
        console.log("[addWallet] Generated session ID:", sessionId);

        // Step 2: Set loading state
        store.setLoading(true);
        store.setError(null);

        // Step 3: Require biometric approval for security
        console.log("[addWallet] Requesting biometric approval...");
        await requireBiometricApproval("Authenticate to connect wallet", {
          allowSessionReuse: true,
        });
        console.log("[addWallet] Biometric approval granted");

        // Step 4: Start MWA transact session - this creates a NEW independent session
        console.log("[addWallet] Starting MWA transact session...");
        const result = await transact(async (walletApi: Web3MobileWallet) => {
          console.log("[addWallet] Inside transact callback");
          console.log(
            "[addWallet] Calling authorize with identity:",
            APP_IDENTITY,
          );

          // Authorize with the wallet - this establishes a new session
          const authorization = await walletApi.authorize({
            identity: APP_IDENTITY,
            chain: SOLANA_CLUSTER,
            features: [...DEFAULT_FEATURES],
            ...(config?.baseUri && { baseUri: config.baseUri }),
          });

          console.log(
            "[addWallet] Authorization successful, accounts:",
            authorization.accounts.length,
          );

          return { authorization, walletApi };
        });

        // Step 5: Normalize and store the session
        const sessions = normalizeAuthorization(
          result.authorization,
          sessionId,
          config?.label,
          (result.authorization as any).wallet_icon,
        );

        console.log("[addWallet] Normalized sessions:", sessions.length);

        // Add first account as the primary session
        const primarySession = sessions[0];
        if (!primarySession) {
          throw new Error("No accounts returned from authorization");
        }

        // Add to store
        store.addSession(primarySession);

        // Add additional accounts if present (multi-account wallets)
        sessions.slice(1).forEach((session) => {
          store.addSession(session);
        });

        const duration = Date.now() - startTime;
        console.log(
          "╔═══════════════════════════════════════════════════════════╗",
        );
        console.log("║ [useMultiWalletManager] >>> SUCCESS: Wallet added");
        console.log("║ Duration: " + duration + "ms");
        console.log(
          "╚═══════════════════════════════════════════════════════════╝",
        );

        store.setLoading(false);

        return {
          sessionId: primarySession.sessionId,
          session: primarySession,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(
          "╔═══════════════════════════════════════════════════════════╗",
        );
        console.error(
          "║ [useMultiWalletManager] >>> ERROR: Failed to add wallet",
        );
        console.error("║ Duration: " + duration + "ms");
        console.error(
          "╚═══════════════════════════════════════════════════════════╝",
        );
        console.error("[addWallet] Error:", error?.message || error);

        store.setLoading(false);
        store.setError(
          error?.message || "Failed to connect wallet. Please try again.",
        );

        // Handle specific error types
        if (error?.message?.includes("wallet not found")) {
          throw new Error(
            "No compatible wallet found. Please install a Solana wallet app.",
          );
        } else if (error?.message?.includes("cancelled")) {
          throw new Error("Wallet connection was cancelled.");
        } else if (error?.message?.includes("biometric")) {
          throw new Error(
            "Biometric authentication failed. Please enable Face ID, Touch ID, or passcode.",
          );
        }

        throw error;
      }
    },
    [store, normalizeAuthorization],
  );

  /**
   * Remove a wallet session by session ID or address.
   */
  const removeWallet = useCallback(
    async (sessionIdOrAddress: string): Promise<void> => {
      console.log("[removeWallet] Removing wallet:", sessionIdOrAddress);

      try {
        store.setLoading(true);

        // Find session
        const session =
          store.sessions[sessionIdOrAddress] ||
          store.getSessionByAddress(sessionIdOrAddress);

        if (!session) {
          throw new Error("Wallet session not found");
        }

        // Attempt to deauthorize on wallet side
        if (session.authToken) {
          try {
            await transact(async (walletApi: Web3MobileWallet) => {
              await walletApi.deauthorize({
                auth_token: session.authToken,
              });
            });
            console.log("[removeWallet] Deauthorization successful");
          } catch (deauthError) {
            console.warn(
              "[removeWallet] Deauthorization failed (ignored):",
              deauthError,
            );
          }
        }

        // Remove from store
        store.removeSession(session.sessionId);
        store.setLoading(false);

        console.log("[removeWallet] Wallet removed successfully");
      } catch (error: any) {
        console.error("[removeWallet] Error:", error);
        store.setLoading(false);
        store.setError(error?.message || "Failed to remove wallet");
        throw error;
      }
    },
    [store],
  );

  /**
   * Set active wallet session.
   */
  const setActiveWallet = useCallback(
    (sessionIdOrAddress: string): void => {
      console.log("[setActiveWallet] Setting active:", sessionIdOrAddress);

      const session =
        store.sessions[sessionIdOrAddress] ||
        store.getSessionByAddress(sessionIdOrAddress);

      if (!session) {
        const error = new Error("Wallet session not found");
        console.error("[setActiveWallet]", error);
        store.setError(error.message);
        return;
      }

      store.setActiveSession(session.sessionId);
      console.log("[setActiveWallet] Active wallet set to:", session.sessionId);
    },
    [store],
  );

  /**
   * Get wallet API for a specific session.
   * This is an internal helper to establish a transact session for a specific wallet.
   */
  const getWalletApiForSession = useCallback(
    async (session: WalletSession): Promise<Web3MobileWallet> => {
      return new Promise((resolve, reject) => {
        transact(async (walletApi: Web3MobileWallet) => {
          try {
            // Reauthorize using the session's auth token
            console.log(
              "[getWalletApiForSession] Reauthorizing session:",
              session.sessionId,
            );
            await walletApi.reauthorize({
              identity: APP_IDENTITY,
              auth_token: session.authToken,
            });
            console.log("[getWalletApiForSession] Reauthorization successful");
            resolve(walletApi);
          } catch (error) {
            console.error(
              "[getWalletApiForSession] Reauthorization failed:",
              error,
            );
            reject(error);
          }
        }).catch(reject);
      });
    },
    [],
  );

  /**
   * Sign a transaction with specified wallet.
   */
  const signTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      options?: SignTransactionOptions,
    ): Promise<Uint8Array> => {
      console.log("[signTransaction] Signing transaction");

      const { sessionId, walletAddress } = options || {};

      // Determine which session to use
      let session: WalletSession | null | undefined;
      if (sessionId) {
        session = store.sessions[sessionId];
      } else if (walletAddress) {
        session = store.getSessionByAddress(walletAddress);
      } else {
        session = store.activeSessionId
          ? store.sessions[store.activeSessionId]
          : null;
      }

      if (!session) {
        throw new Error("No wallet session available for signing");
      }

      if (session.status !== "connected") {
        throw new Error("Wallet session is not connected");
      }

      try {
        store.setLoading(true);

        // Require biometric approval
        await requireBiometricApproval("Authenticate to sign transaction");

        // Get wallet API for this session
        const walletApi = await getWalletApiForSession(session);

        // Sign the transaction
        const [signedTransaction] = await walletApi.signTransactions({
          transactions: [transaction],
        });

        if (!signedTransaction) {
          throw new Error("Wallet did not return a signed transaction");
        }

        // Serialize the signed transaction to Uint8Array
        const serializedTransaction =
          signedTransaction instanceof VersionedTransaction
            ? signedTransaction.serialize()
            : (signedTransaction as Transaction).serialize({
                requireAllSignatures: false,
              });

        // Update last activity
        store.updateSession(session.sessionId, {
          lastActivityAt: Date.now(),
        });

        store.setLoading(false);
        console.log("[signTransaction] Transaction signed successfully");

        return serializedTransaction;
      } catch (error: any) {
        console.error("[signTransaction] Error:", error);
        store.setLoading(false);
        store.setError(error?.message || "Failed to sign transaction");

        // Update session status on error
        if (error?.message?.includes("authorization")) {
          store.updateSession(session.sessionId, {
            status: "error",
            errorMessage: error?.message,
          });
        }

        throw error;
      }
    },
    [store, getWalletApiForSession],
  );

  /**
   * Sign multiple transactions.
   */
  const signAllTransactions = useCallback(
    async (
      transactions: Array<Transaction | VersionedTransaction>,
      options?: SignTransactionOptions,
    ): Promise<Uint8Array[]> => {
      console.log(
        "[signAllTransactions] Signing",
        transactions.length,
        "transactions",
      );

      const { sessionId, walletAddress } = options || {};

      // Determine which session to use
      let session: WalletSession | null | undefined;
      if (sessionId) {
        session = store.sessions[sessionId];
      } else if (walletAddress) {
        session = store.getSessionByAddress(walletAddress);
      } else {
        session = store.activeSessionId
          ? store.sessions[store.activeSessionId]
          : null;
      }

      if (!session) {
        throw new Error("No wallet session available for signing");
      }

      try {
        store.setLoading(true);
        await requireBiometricApproval("Authenticate to sign transactions");

        const walletApi = await getWalletApiForSession(session);

        const signedTransactions = await walletApi.signTransactions({
          transactions,
        });

        // Serialize all signed transactions to Uint8Array[]
        const serializedTransactions = signedTransactions.map((tx) =>
          tx instanceof VersionedTransaction
            ? tx.serialize()
            : (tx as Transaction).serialize({ requireAllSignatures: false }),
        );

        store.updateSession(session.sessionId, {
          lastActivityAt: Date.now(),
        });

        store.setLoading(false);
        console.log(
          "[signAllTransactions] All transactions signed successfully",
        );

        return serializedTransactions;
      } catch (error: any) {
        console.error("[signAllTransactions] Error:", error);
        store.setLoading(false);
        store.setError(error?.message || "Failed to sign transactions");
        throw error;
      }
    },
    [store, getWalletApiForSession],
  );

  /**
   * Sign a message.
   */
  const signMessage = useCallback(
    async (
      message: Uint8Array,
      options?: SignTransactionOptions,
    ): Promise<Uint8Array> => {
      console.log("[signMessage] Signing message");

      const { sessionId, walletAddress } = options || {};

      // Determine which session to use
      let session: WalletSession | null | undefined;
      if (sessionId) {
        session = store.sessions[sessionId];
      } else if (walletAddress) {
        session = store.getSessionByAddress(walletAddress);
      } else {
        session = store.activeSessionId
          ? store.sessions[store.activeSessionId]
          : null;
      }

      if (!session) {
        throw new Error("No wallet session available for signing");
      }

      try {
        store.setLoading(true);
        await requireBiometricApproval("Authenticate to sign message");

        const walletApi = await getWalletApiForSession(session);

        const addressBase64 = Buffer.from(
          new PublicKey(session.address).toBytes(),
        ).toString("base64");

        const [signature] = await walletApi.signMessages({
          addresses: [addressBase64],
          payloads: [message],
        });

        if (!signature) {
          throw new Error("Wallet did not return a signature");
        }

        store.updateSession(session.sessionId, {
          lastActivityAt: Date.now(),
        });

        store.setLoading(false);
        console.log("[signMessage] Message signed successfully");

        return signature;
      } catch (error: any) {
        console.error("[signMessage] Error:", error);
        store.setLoading(false);
        store.setError(error?.message || "Failed to sign message");
        throw error;
      }
    },
    [store, getWalletApiForSession],
  );

  /**
   * Disconnect all wallets.
   */
  const disconnectAll = useCallback(async (): Promise<void> => {
    console.log("[disconnectAll] Disconnecting all wallets");

    try {
      store.setLoading(true);

      const sessions = store.getAllSessions();

      // Deauthorize each session
      await Promise.all(
        sessions.map(async (session) => {
          if (session.authToken) {
            try {
              await transact(async (walletApi: Web3MobileWallet) => {
                await walletApi.deauthorize({
                  auth_token: session.authToken,
                });
              });
            } catch (error) {
              console.warn(
                "[disconnectAll] Deauthorization failed for session:",
                session.sessionId,
                error,
              );
            }
          }
        }),
      );

      // Clear all sessions from store
      store.clearAllSessions();
      store.setLoading(false);

      console.log("[disconnectAll] All wallets disconnected");
    } catch (error: any) {
      console.error("[disconnectAll] Error:", error);
      store.setLoading(false);
      store.setError(error?.message || "Failed to disconnect wallets");
      throw error;
    }
  }, [store]);

  /**
   * Refresh authorization for a session.
   */
  const refreshSession = useCallback(
    async (sessionId: string): Promise<WalletSession | null> => {
      console.log("[refreshSession] Refreshing session:", sessionId);

      const session = store.sessions[sessionId];
      if (!session) {
        throw new Error("Session not found");
      }

      try {
        store.setLoading(true);

        const result = await transact(async (walletApi: Web3MobileWallet) => {
          let authorization: AuthorizationResult;

          try {
            // Try silent reauthorization first
            authorization = await walletApi.reauthorize({
              identity: APP_IDENTITY,
              auth_token: session.authToken,
            });
            console.log("[refreshSession] Silent reauthorization successful");
          } catch (error) {
            console.warn(
              "[refreshSession] Silent reauthorization failed, requesting fresh authorization",
            );
            // Fall back to full authorization
            authorization = await walletApi.authorize({
              identity: APP_IDENTITY,
              chain: SOLANA_CLUSTER,
              features: [...DEFAULT_FEATURES],
            });
          }

          return authorization;
        });

        // Update session with new auth token
        const updatedSession: WalletSession = {
          ...session,
          authToken: result.auth_token,
          lastActivityAt: Date.now(),
        };

        // Update store
        store.updateSession(sessionId, updatedSession);
        store.setLoading(false);

        console.log("[refreshSession] Session refreshed successfully");
        return updatedSession;
      } catch (error: any) {
        console.error("[refreshSession] Error:", error);
        store.setLoading(false);
        store.setError(error?.message || "Failed to refresh session");

        // Mark session as error
        store.updateSession(sessionId, {
          status: "error",
          errorMessage: error?.message,
        });

        return null;
      }
    },
    [store],
  );

  /**
   * Update wallet label.
   */
  const updateWalletLabel = useCallback(
    (sessionIdOrAddress: string, label: string): void => {
      console.log("[updateWalletLabel] Updating label:", label);

      const session =
        store.sessions[sessionIdOrAddress] ||
        store.getSessionByAddress(sessionIdOrAddress);

      if (!session) {
        const error = new Error("Wallet session not found");
        console.error("[updateWalletLabel]", error);
        store.setError(error.message);
        return;
      }

      store.updateSession(session.sessionId, { label });
      console.log("[updateWalletLabel] Label updated");
    },
    [store],
  );

  /**
   * Memoized return object.
   */
  return useMemo<UseMultiWalletManagerReturn>(
    () => ({
      sessions: store.getAllSessions(),
      activeSession: store.activeSessionId
        ? store.sessions[store.activeSessionId]
        : null,
      activeWalletAddress: store.activeSessionId
        ? store.sessions[store.activeSessionId]?.address || null
        : null,
      isLoading: store.isLoading,
      error: store.error,
      addWallet,
      removeWallet,
      setActiveWallet,
      signTransaction,
      signAllTransactions,
      signMessage,
      disconnectAll,
      refreshSession,
      updateWalletLabel,
      hasWallets: store.getAllSessions().length > 0,
      walletCount: store.getAllSessions().length,
    }),
    [
      store,
      addWallet,
      removeWallet,
      setActiveWallet,
      signTransaction,
      signAllTransactions,
      signMessage,
      disconnectAll,
      refreshSession,
      updateWalletLabel,
    ],
  );
}
