export interface AccountMeta {
  address: string;
  label?: string;
}

export interface LinkedWallet extends AccountMeta {
  authToken: string;
  walletAppId?: string;
  walletName?: string;
  icon?: string;
  groupId?: string;
  groupName?: string;
  lastAuthorizedAt?: string;
  capabilities?: {
    supportsSignAndSendTransactions: boolean;
    supportsSignTransactions: boolean;
    supportsSignMessages: boolean;
  };
}

export interface WalletGroup {
  id: string;
  name: string;
  walletAddresses: string[];
  createdAt: string;
  updatedAt?: string;
  description?: string;
}

export interface AuthorizationPreview {
  accounts: LinkedWallet[];
  walletName?: string;
  walletIcon?: string;
}

export interface WalletBalance {
  address: string;
  balance: number;
  usdValue: number;
  lastUpdated: string;
  tokens: TokenBalance[];
  totalTokens: number;
  totalValue: number;
}

export interface TokenBalance {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  usdValue: number;
  decimals: number;
  pricePerToken?: number;
  logoURI?: string;
  isNative?: boolean;
}

export interface WalletActivity {
  signature: string;
  timestamp: number;
  type: "transfer" | "token_transfer" | "stake" | "swap" | "nft_transfer" | "mint" | "burn" | "unknown";
  description?: string;
  fee?: number;
  source?: string;
  destination?: string;
  mint?: string;
  amount?: number;
  amountUnit?: string;
  direction?: "in" | "out" | "internal";
  status: "success" | "pending" | "failed";
}

export interface WalletState {
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  activeWalletAddress: string | null;
  balances: Record<string, number>;
  detailedBalances: Record<string, WalletBalance>;
  missingTokenPrices?: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface WalletStoreActions {
  setLinkedWallets: (wallets: LinkedWallet[]) => void;
  setActiveWallet: (wallet: LinkedWallet | null) => void;
  setActiveWalletAddress: (address: string | null) => void;
  updateBalance: (address: string, balance: number) => void;
  updateDetailedBalance: (balance: WalletBalance) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addWallet: (wallet: LinkedWallet) => void;
  removeWallet: (address: string) => void;
  clearAllWallets: () => void;
  setIsAuthenticated: (authenticated: boolean) => void;
}
