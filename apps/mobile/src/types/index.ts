import type { LinkedWallet } from "./wallet";

// Export all types from existing files
export * from "./wallet";
export * from "./icon";

// Transaction related types
export interface Transaction {
  id: string;
  signature: string;
  source: string;
  destination: string;
  amount: number;
  amountUnit?: string;
  status: "success" | "pending" | "failed";
  timestamp: string;
  type: "transfer" | "swap" | "nft" | "program";
  fee?: number;
  slot?: number;
  memo?: string;
}

export interface AuthorizationEvent {
  id: string;
  walletAddress: string;
  walletName?: string;
  method: string;
  status: "fresh" | "stale";
  timestamp: string;
}

// RPC related types
export interface RpcError {
  code: number;
  message: string;
  data?: any;
}

export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: RpcError;
}

// Service related types
export interface ServiceRegistry {
  price: any;
  telemetry: any;
  authorization: any;
  icon: any;
  wallet: any;
  walletAdapter: any;
  rpc: any;
  helius: any;
}

// Store related types
export interface WalletStoreState {
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  activeWalletAddress: string | null;
  balances: Record<string, number>;
  missingTokenPrices?: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setLinkedWallets: (wallets: LinkedWallet[]) => void;
  setActiveWallet: (wallet: LinkedWallet | null) => void;
  setActiveWalletAddress: (address: string | null) => void;
  updateBalance: (address: string, balance: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addWallet: (wallet: LinkedWallet) => void;
  removeWallet: (address: string) => void;
  clearAllWallets: () => void;
}

// UI related types
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  message?: string;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
}
