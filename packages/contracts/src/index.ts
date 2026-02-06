export type WalletProvider =
  | 'phantom'
  | 'solflare'
  | 'backpack'
  | 'ledger'
  | 'mobile-stack'
  | 'custom';

export interface WalletBalance {
  tokenSymbol: string;
  mint: string;
  amount: number;
  usdValue: number;
}

export interface WalletAccount {
  address: string;
  label?: string;
  provider: WalletProvider;
  balances: WalletBalance[];
  totalUsdValue: number;
  shareOfPortfolio: number;
  lastSync: string;
  sessionKeyIds: string[];
}

export interface PendingAction {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface AggregatedPortfolio {
  wallets: WalletAccount[];
  totalUsdValue: number;
  change24hPercent: number;
  pendingActions: PendingAction[];
}

export type SessionKeyStatus = 'active' | 'revoked' | 'expired';

export interface SessionScope {
  name: 'transfer' | 'stake' | 'swap' | 'custom';
  maxUsd?: number;
  destinations?: string[];
  programs?: string[];
}

export interface SessionKey {
  id: string;
  walletAddress: string;
  derivedPublicKey: string;
  devicePublicKey: string;
  issuedAt: string;
  expiresAt: string;
  scopes: SessionScope[];
  status: SessionKeyStatus;
  policyId: string;
  lastUsedAt?: string;
  metadata?: Record<string, string>;
}

export interface SessionPolicy {
  id: string;
  walletAddress: string;
  maxDailySpendUsd: number;
  maxTxPerHour: number;
  allowedPrograms: string[];
  allowedDestinations: string[];
}

export interface IssueSessionKeyPayload {
  walletAddress: string;
  devicePublicKey: string;
  scopes: SessionScope[];
  expiresInMinutes: number;
  metadata?: Record<string, string>;
}

export const computeAggregatedPortfolio = (
  wallets: WalletAccount[],
  pendingActions: PendingAction[] = [],
  change24hPercent = 0,
): AggregatedPortfolio => {
  const totalUsdValue = wallets.reduce((sum, wallet) => sum + wallet.totalUsdValue, 0);
  const normalizedWallets =
    totalUsdValue === 0
      ? wallets
      : wallets.map((wallet) => ({
          ...wallet,
          shareOfPortfolio: Number(((wallet.totalUsdValue / totalUsdValue) * 100).toFixed(2)),
        }));

  return {
    wallets: normalizedWallets,
    totalUsdValue: Number(totalUsdValue.toFixed(2)),
    change24hPercent,
    pendingActions,
  };
};
