import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import type {
  SilentReauthorizationRecord,
  WalletCapabilityReport,
} from "@wallethub/contracts";
import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { SolanaStoreState } from "../solanaStore";
import { authorizationApi, walletService } from "../../services";
import { requireBiometricApproval } from "../../security/biometrics";
import type { LinkedWallet } from "../../types/wallet";
import { normalizeAuthorization } from "../utils/authorizationUtils";
import {
  mapCapabilities,
  DEFAULT_CAPABILITIES,
} from "../utils/capabilitiesUtils";
import { APP_IDENTITY } from "../utils/constants";

export const createTransactionActions = (
  set: any,
  get: () => SolanaStoreState,
) => ({
  sendSol: async (
    recipient: string,
    amountSol: number,
    options?: { fromAddress?: string },
  ): Promise<string> => {
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

    const currentBalance = state.balances[sourceAddress];
    if (
      typeof currentBalance === "number" &&
      currentBalance < amountSol * LAMPORTS_PER_SOL
    ) {
      throw new Error("Insufficient balance");
    }

    try {
      set({ isLoading: true, error: null });

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
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        }),
      );
      transaction.feePayer = senderPubkey;
      transaction.recentBlockhash = latestBlockhash.blockhash;

      let fallbackSignedTransaction: Transaction | null = null;
      let submittedSignature: string | null = null;

      await transact(async (wallet: Web3MobileWallet) => {
        let authorization: AuthorizationResult;
        const capabilities = await wallet
          .getCapabilities()
          .catch((err: unknown) => {
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
          const state = get();
          authorization = await wallet.authorize({
            identity: APP_IDENTITY,
            chain: `solana:${state.network}`,
            features: [
              "solana:signAndSendTransactions",
              "solana:signTransactions",
            ],
          });
        }

        const normalizedAccounts = normalizeAuthorization(authorization);

        set((prev: SolanaStoreState) => {
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
      const errorMessage =
        error instanceof Error ? error.message : "Transaction failed";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },
});
