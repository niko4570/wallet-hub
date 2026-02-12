import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol";
import type {
  MobileWallet,
  AuthorizationResult,
} from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Transaction, PublicKey } from "@solana/web3.js";
import { useWalletStore } from "../store/walletStore";
import { walletService } from "./walletService";
import { DetectedWalletApp, LinkedWallet } from "../types/wallet";

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
   * Connect to a wallet using MWA
   * @param walletApp Optional wallet app to connect to
   * @returns Array of linked wallets
   */
  async connectWallet(walletApp?: DetectedWalletApp): Promise<LinkedWallet[]> {
    const walletStore = useWalletStore.getState();
    walletStore.setLoading(true);
    walletStore.setError(null);

    try {
      // Use existing walletService to start authorization
      const preview = await walletService.startWalletAuthorization(walletApp);
      const accounts = await walletService.finalizeWalletAuthorization(preview);

      // Update wallet store
      walletStore.setLinkedWallets(accounts);
      walletStore.setActiveWallet(accounts[0]);
      walletStore.setActiveWalletAddress(accounts[0].address);

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
      const result = await transact(
        async (walletInstance: MobileWallet) => {
          // First authorize if needed
          let authorization: AuthorizationResult;
          try {
            authorization = await walletInstance.authorize({
              identity: {
                name: "WalletHub",
                uri: "https://wallethub.app",
              },
              chain: "solana:mainnet-beta",
            });
          } catch (error) {
            console.error("Authorization failed, trying reauthorize:", error);
            authorization = await walletInstance.reauthorize({
              identity: {
                name: "WalletHub",
                uri: "https://wallethub.app",
              },
              auth_token: wallet.authToken,
            });
          }

          // Sign and send transaction
          const { signatures } = await walletInstance.signAndSendTransactions({
            payloads: [
              Buffer.from(
                transaction.serialize({ requireAllSignatures: false }),
              ).toString("base64"),
            ],
            options: {
              commitment: "confirmed",
              skip_preflight: false,
            },
          });

          return signatures[0];
        },
        wallet.walletUriBase ? { baseUri: wallet.walletUriBase } : undefined,
      );

      return result;
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
      await Promise.all(
        addresses.map(async (address) => {
          try {
            const balance = await walletService.getWalletBalance(address);
            walletStore.updateBalance(address, balance);
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
      const balance = await walletService.getWalletBalance(address);
      walletStore.updateBalance(address, balance);
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
