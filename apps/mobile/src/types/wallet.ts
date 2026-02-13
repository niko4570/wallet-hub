export interface WalletCatalogEntry {
  id: string;
  name: string;
  icon: string;
  scheme?: string;
  baseUri?: string;
  publisher?: string;
  subtitle?: string;
}

export interface DetectedWalletApp extends WalletCatalogEntry {
  installed: boolean;
  detectionMethod: "scheme" | "fallback" | "error";
}

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
  walletApp?: DetectedWalletApp;
  accounts: LinkedWallet[];
}

export interface WalletBalance {
  address: string;
  balance: number;
  usdValue: number;
  lastUpdated: string;
}

export interface WalletState {
  linkedWallets: LinkedWallet[];
  activeWallet: LinkedWallet | null;
  balances: Record<string, number>;
  missingTokenPrices?: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
}
