// Export all types from existing files
export * from "./wallet";
export * from "./dashboard";

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
  type:
    | "transfer"
    | "token_transfer"
    | "stake_delegate"
    | "stake_withdraw"
    | "nft_transfer"
    | "swap";
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
  data?: unknown;
}

export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: RpcError;
}

// Historical data types
export interface HistoricalBalance {
  timestamp: number;
  usd: number;
  sol: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValueUSD: number;
  version?: number;
}

// Service related types
export interface ServiceRegistry {
  price: any; // Will be typed in future
  authorization: any; // Will be typed in future
  icon: any; // Will be typed in future
  wallet: any; // Will be typed in future
  walletAdapter: any; // Will be typed in future
  rpc: any; // Will be typed in future
  helius: any; // Will be typed in future
  secureStorage: any; // Will be typed in future
  jupiter: any; // Will be typed in future
  tokenMetadata: any; // Will be typed in future
  notification: any; // Will be typed in future
  watchlistData: any; // Will be typed in future
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

export type ChainId =
  | "solana:mainnet-beta"
  | "solana:testnet"
  | "solana:devnet";

export interface TokenAsset {
  chain: ChainId;
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
  priceUsd?: number;
  liquidityUsd?: number;
}

// Chart related types
export interface ChartDataPoint {
  x: number;
  y: number;
}

export interface TimeRangeOption {
  value: "1D" | "7D" | "30D";
  label: string;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Solana specific types
export type SolanaCluster = "mainnet-beta" | "testnet" | "devnet";

// Portfolio related types
export interface PortfolioPerformance {
  currentValue: number;
  change24h: number;
  change7d: number;
  change30d: number;
  totalReturn: number;
  assets: TokenAsset[];
}

// Asset allocation types
export interface AssetAllocation {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  mint?: string;
}
