export interface AccountMeta {
  address: string;
  label?: string;
}

export interface LinkedWallet extends AccountMeta {
  authToken: string;
  walletUriBase?: string | null;
  walletAppId?: string;
  walletName?: string;
  icon?: string;
  groupId?: string;
  groupName?: string;
}

export interface WalletGroup {
  id: string;
  name: string;
  walletAddresses: string[];
  createdAt: string;
}

export interface AuthorizationPreview {
  accounts: LinkedWallet[];
}

export interface WalletBalance {
  address: string;
  balance: number;
  usdValue: number;
  lastUpdated: string;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  usdValue: number;
  decimals: number;
}

export interface WalletActivity {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  fee?: number;
  source?: string;
  mint?: string;
  amount?: number;
  direction?: "in" | "out" | "internal";
}

export interface WatchOnlyAccount {
  address: string;
  label?: string;
  color?: string;
  createdAt?: string;
}

export interface WalletState {
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  balances: Record<string, number>;
  missingTokenPrices?: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
}
