import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Connection, PublicKey } from "@solana/web3.js";
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";
import { requireBiometricApproval } from "../security/biometrics";
import { decodeWalletAddress } from "../utils/solanaAddress";
import { LinkedWallet, AuthorizationPreview } from "../types/wallet";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
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
}

export const walletService = new WalletService();
