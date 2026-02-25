import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useShallow } from "zustand/react/shallow";
import { Connection } from "@solana/web3.js";
import { HELIUS_RPC_URL } from "../config/env";
import type {
  LinkedWallet,
  WalletBalance,
  AuthorizationPreview,
} from "../types/wallet";
import type { SilentReauthorizationRecord } from "@wallethub/contracts";
import { useWalletBaseStore } from "./walletStore";
import { createWalletActions } from "./actions/walletActions";
import { createBalanceActions } from "./actions/balanceActions";
import { createNetworkActions } from "./actions/networkActions";
import { createTransactionActions } from "./actions/transactionActions";

type Network = "mainnet-beta" | "devnet" | "testnet";

export interface SolanaStoreState {
  // Wallet connection state
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  activeWalletAddress: string | null;
  isAuthenticated: boolean;

  // Balance state
  balances: Record<string, number>;
  detailedBalances: Record<string, WalletBalance>;

  // Transaction state
  isLoading: boolean;
  error: string | null;

  // Network state
  network: Network;

  // Connection
  connection: Connection;

  // Actions
  disconnect: (address?: string) => Promise<void>;
  sendSol: (
    recipient: string,
    amountSol: number,
    options?: { fromAddress?: string },
  ) => Promise<string>;
  registerPrimaryWallet: () => Promise<LinkedWallet[]>;
  selectActiveWallet: (address: string) => void;
  refreshBalance: (address?: string) => Promise<number | null>;
  startAuthorization: () => Promise<AuthorizationPreview>;
  finalizeAuthorization: (
    preview: AuthorizationPreview,
    selectedAddresses?: string[],
  ) => Promise<LinkedWallet[]>;
  silentRefreshAuthorization: (
    address?: string,
  ) => Promise<SilentReauthorizationRecord | null>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setNetwork: (network: Network) => void;
  getRpcUrl: (network: Network) => string;
}

export const useSolanaStore = create<SolanaStoreState>()(
  persist(
    (set, get) => ({
      linkedWallets: [],
      activeWallet: null,
      activeWalletAddress: null,
      isAuthenticated: false,
      balances: {},
      detailedBalances: {},
      isLoading: false,
      error: null,
      network: "mainnet-beta" as Network,
      connection: new Connection(
        "https://api.mainnet-beta.solana.com",
        "confirmed",
      ),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      ...createWalletActions(set, get),
      ...createBalanceActions(set, get),
      ...createNetworkActions(set, get),
      ...createTransactionActions(set, get),
    }),
    {
      name: "solana-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        linkedWallets: state.linkedWallets,
        activeWallet: state.activeWallet,
        activeWalletAddress: state.activeWalletAddress,
        isAuthenticated: state.isAuthenticated,
        balances: state.balances,
        detailedBalances: state.detailedBalances,
      }),
    },
  ),
);

// Helper selectors with useShallow optimization
export const useSolanaSelectors = () => {
  return useSolanaStore(
    useShallow((state) => ({
      linkedWallets: state.linkedWallets,
      activeWallet: state.activeWallet,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      error: state.error,
      connection: state.connection,
      balances: state.balances,
      detailedBalances: state.detailedBalances,
      hasActiveWallet: !!state.activeWallet,
      walletCount: state.linkedWallets.length,
      activeWalletBalance: state.activeWallet
        ? state.balances[state.activeWallet.address] || 0
        : 0,
      activeWalletUsdValue: state.activeWallet
        ? state.detailedBalances[state.activeWallet.address]?.usdValue || 0
        : 0,
    })),
  );
};
