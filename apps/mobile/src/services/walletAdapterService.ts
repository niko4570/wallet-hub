import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWalletStore } from "../store/walletStore";
import { walletService } from "./walletService";
import { priceService } from "./priceService";
import { LinkedWallet } from "../types/wallet";
import { SOLANA_CLUSTER } from "../config/env";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
};

class WalletAdapterService {
  private static instance: WalletAdapterService;

  private constructor() {}

  static getInstance(): WalletAdapterService {
    if (!WalletAdapterService.instance) {
      WalletAdapterService.instance = new WalletAdapterService();
    }
    return WalletAdapterService.instance;
  }

   /**
    * Connect to a wallet using the system wallet chooser.
    */
   async connectWallet(): Promise<LinkedWallet[]> {
    const walletStore = useWalletStore.getState();
    walletStore.setLoading(true);
    walletStore.setError(null);

    try {
      // Use existing walletService to start authorization. Passing no wallet lets MWA
      // present its native chooser when multiple wallets are installed.
       const preview = await walletService.startWalletAuthorization();
      const accounts = await walletService.finalizeWalletAuthorization(preview);

      // Update wallet store - add new accounts instead of replacing all
      const existingWallets = walletStore.linkedWallets;
      const combinedWallets = [...existingWallets];
      
      // Add new accounts that don't already exist
      accounts.forEach((newAccount) => {
        const existingIndex = combinedWallets.findIndex(
          (wallet) => wallet.address === newAccount.address
        );
        
        if (existingIndex === -1) {
          combinedWallets.push(newAccount);
        } else {
          // Update existing account with new information
          combinedWallets[existingIndex] = newAccount;
        }
      });
      
      walletStore.setLinkedWallets(combinedWallets);
      
      // Set active wallet to the first new account if not already set
      if (!walletStore.activeWallet && accounts.length > 0) {
        walletStore.setActiveWallet(accounts[0]);
        walletStore.setActiveWalletAddress(accounts[0].address);
      }

      // Refresh balances for new wallets
      await this.refreshBalances(accounts.map((account) => account.address));

      return accounts;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      walletStore.setError("Failed to connect wallet. Please try again.");
      throw error;
    } finally {
      walletStore.setLoading(false);
    }
  }

  /**
   * Disconnect from a wallet
   * @param address Address of the wallet to disconnect
   */
  async disconnectWallet(address: string): Promise<void> {
    const walletStore = useWalletStore.getState();
    walletStore.setLoading(true);

    try {
      // Remove wallet from store
      walletStore.removeWallet(address);
    } catch (error) {
      console.error("Wallet disconnection failed:", error);
      walletStore.setError("Failed to disconnect wallet. Please try again.");
      throw error;
    } finally {
      walletStore.setLoading(false);
    }
  }

  /**
   * Sign and send a transaction
   * @param transaction Transaction to sign and send
   * @param wallet Wallet to use for signing
   * @returns Transaction signature
   */
  async signAndSendTransaction(
    transaction: Transaction,
    wallet: LinkedWallet,
  ): Promise<string> {
    try {
      const signature = await transact(
        async (walletInstance: Web3MobileWallet) => {
          let authorization: AuthorizationResult | null = null;

          if (wallet.authToken) {
            try {
              authorization = await walletInstance.reauthorize({
                identity: APP_IDENTITY,
                auth_token: wallet.authToken,
              });
            } catch (error) {
              console.warn("Reauthorization failed, falling back to authorize", error);
            }
          }

          if (!authorization) {
            authorization = await walletInstance.authorize({
              identity: APP_IDENTITY,
              chain: SOLANA_CLUSTER,
            });
          }

          const [signedSignature] = await walletInstance.signAndSendTransactions({
            commitment: "confirmed",
            skipPreflight: false,
            transactions: [transaction],
          });

          if (!signedSignature) {
            throw new Error("Wallet did not return a transaction signature");
          }

          return signedSignature;
        },
        wallet.walletUriBase ? { baseUri: wallet.walletUriBase } : undefined,
      );

      return signature;
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  }

  /**
   * Refresh balances for multiple wallets
   * @param addresses Array of wallet addresses
   */
  async refreshBalances(addresses: string[]): Promise<void> {
    const walletStore = useWalletStore.getState();

    try {
      const price = await priceService.getSolPriceInUsd();
      const timestamp = new Date().toISOString();
      await Promise.all(
        addresses.map(async (address) => {
          try {
            const balance = await walletService.getWalletBalance(address);
            walletStore.updateBalance(address, balance);
            const solBalance = balance / LAMPORTS_PER_SOL;
            walletStore.updateDetailedBalance({
              address,
              balance: solBalance,
              usdValue: solBalance * price,
              lastUpdated: timestamp,
              tokens: [],
            });
          } catch (error) {
            console.warn(`Failed to refresh balance for ${address}:`, error);
          }
        }),
      );
    } catch (error) {
      console.error("Failed to refresh balances:", error);
    }
  }

  /**
   * Refresh balance for a single wallet
   * @param address Wallet address
   * @returns Balance in lamports
   */
  async refreshBalance(address: string): Promise<number | null> {
    const walletStore = useWalletStore.getState();

    try {
      const price = await priceService.getSolPriceInUsd();
      const timestamp = new Date().toISOString();
      const balance = await walletService.getWalletBalance(address);
      walletStore.updateBalance(address, balance);
      const solBalance = balance / LAMPORTS_PER_SOL;
      walletStore.updateDetailedBalance({
        address,
        balance: solBalance,
        usdValue: solBalance * price,
        lastUpdated: timestamp,
        tokens: [],
      });
      return balance;
    } catch (error) {
      console.error(`Failed to refresh balance for ${address}:`, error);
      return null;
    }
  }

  /**
   * Switch active wallet
   * @param address Address of the wallet to switch to
   */
  switchActiveWallet(address: string): void {
    const walletStore = useWalletStore.getState();
    walletStore.setActiveWalletAddress(address);
  }

  /**
   * Clear all wallets
   */
  clearAllWallets(): void {
    const walletStore = useWalletStore.getState();
    walletStore.clearAllWallets();
  }
}

export const walletAdapterService = WalletAdapterService.getInstance();
