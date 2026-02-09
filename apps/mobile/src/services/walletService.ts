import { Linking } from "react-native";
import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Connection, PublicKey } from "@solana/web3.js";
import { WALLET_DIRECTORY } from "../config/wallets";
import { API_CONFIG } from "../config/api";
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
    this.connection = new Connection(
      API_CONFIG.WALLET_DIRECTORY.SOLANA_WALLET_ADAPTER,
      "confirmed",
    );
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

  async startWalletAuthorization(
    wallet?: DetectedWalletApp,
  ): Promise<AuthorizationPreview> {
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
            identity: {
              name: "WalletHub",
              uri: "https://wallethub.app",
            },
            chain: "solana:mainnet",
          });
        },
        transactOptions,
      );

      const normalized = this.normalizeAuthorization(authorization, wallet);
      return { walletApp: wallet, accounts: normalized };
    } catch (error) {
      console.error("Wallet authorization failed", error);
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
    return authorization.accounts.map((accountFromWallet) => ({
      address: decodeWalletAddress(accountFromWallet.address),
      label: accountFromWallet.label,
      authToken: authorization.auth_token,
      walletUriBase:
        authorization.wallet_uri_base ?? walletApp?.baseUri ?? null,
      walletAppId: walletApp?.id,
      walletName: walletApp?.name ?? accountFromWallet.label,
      icon: walletApp?.icon,
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
}

export const walletService = new WalletService();
