import {
  AggregatedPortfolio,
  PendingAction,
  WalletAccount,
  WalletBalance,
  computeAggregatedPortfolio,
} from '@wallethub/contracts';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LinkWalletDto } from './dto/link-wallet.dto';

const JUPITER_PORTFOLIO_ENDPOINT =
  'https://api.jup.ag/portfolio/v1/wallet' as const;
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const PORTFOLIO_CACHE_TTL_MS = 60 * 1000;
const TRANSACTION_CACHE_TTL_MS = 30 * 1000;
const JUPITER_TRANSACTIONS_ENDPOINT =
  'https://api.jup.ag/portfolio/v1/transactions';
const JUPITER_TRANSACTIONS_LIMIT = 50;

interface PortfolioCacheEntry {
  wallet: WalletAccount;
  expiresAt: number;
}

interface TransactionCacheEntry {
  records: JupiterTransaction[];
  expiresAt: number;
}

export interface JupiterTransaction {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  source?: string;
  pnlUsd?: number;
  amountUsd?: number;
  feeUsd?: number;
  raw: Record<string, any>;
}

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly jupiterApiKey =
    process.env.JUPITER_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_JUPITER_API_KEY?.trim() ||
    '';
  private readonly portfolioCache = new Map<string, PortfolioCacheEntry>();
  private readonly transactionCache = new Map<string, TransactionCacheEntry>();

  private readonly pendingActions: PendingAction[] = [
    {
      id: 'session-rotation',
      title: 'Rotate session keys',
      description:
        'Primary device keys reach policy threshold, rotate within 12h.',
      severity: 'warning',
    },
  ];

  private wallets: WalletAccount[] = [
    {
      address: 'F97p1dA1s5C3q9e7m2x1n4v6b8k0z1r3t5y7u9w1',
      label: 'Backpack Prime',
      provider: 'backpack',
      balances: [
        {
          tokenSymbol: 'SOL',
          mint: 'So11111111111111111111111111111111111111112',
          amount: 13.5,
          usdValue: 13.5 * 95.23,
        },
        {
          tokenSymbol: 'USDC',
          mint: 'EPjFWdd5AufqSSqeM2qZp9wWk9Ez8vgXHxmK9f9kJr1',
          amount: 420,
          usdValue: 420,
        },
      ],
      totalUsdValue: 13.5 * 95.23 + 420,
      shareOfPortfolio: 0,
      lastSync: new Date().toISOString(),
      sessionKeyIds: ['session-1'],
    },
    {
      address: '7t5y3u1i9o7p5a3s2d4f6g8h0j2k4l6z8x0c2v4b6',
      label: 'Ledger Vault',
      provider: 'ledger',
      balances: [
        {
          tokenSymbol: 'SOL',
          mint: 'So11111111111111111111111111111111111111112',
          amount: 35,
          usdValue: 35 * 95.23,
        },
        {
          tokenSymbol: 'JitoSOL',
          mint: 'JitoSOL1111111111111111111111111111111111111',
          amount: 20,
          usdValue: 20 * 110.12,
        },
      ],
      totalUsdValue: 35 * 95.23 + 20 * 110.12,
      shareOfPortfolio: 0,
      lastSync: new Date().toISOString(),
      sessionKeyIds: [],
    },
  ];

  async getAggregatedPortfolio(): Promise<AggregatedPortfolio> {
    const refreshed = await Promise.all(
      this.wallets.map((wallet) =>
        this.refreshWalletFromJupiter(wallet.address, wallet),
      ),
    );

    this.wallets = refreshed;
    return computeAggregatedPortfolio(refreshed, this.pendingActions, 3.4);
  }

  async getWallet(address: string): Promise<WalletAccount> {
    const normalized = address.trim();
    const hydrated = await this.refreshWalletFromJupiter(normalized);
    if (hydrated) {
      return hydrated;
    }

    const fallback = this.wallets.find((item) => item.address === normalized);
    if (!fallback) {
      throw new NotFoundException(`Wallet ${normalized} was not found`);
    }
    return fallback;
  }

  async getWalletTransactions(
    address: string,
  ): Promise<JupiterTransaction[]> {
    const normalized = address.trim();
    const cached = this.getCachedTransactions(normalized);
    if (cached) {
      return cached;
    }

    const fetched = await this.fetchTransactionsFromJupiter(normalized);
    if (fetched.length > 0) {
      this.transactionCache.set(normalized, {
        records: fetched,
        expiresAt: Date.now() + TRANSACTION_CACHE_TTL_MS,
      });
    }
    return fetched;
  }

  linkWallet(payload: LinkWalletDto): WalletAccount {
    const normalizedAddress = payload.address.trim();
    const existing = this.wallets.find(
      (wallet) => wallet.address === normalizedAddress,
    );
    if (existing) {
      return existing;
    }

    const newWallet: WalletAccount = {
      address: normalizedAddress,
      label: payload.label ?? 'New Wallet',
      provider: payload.provider,
      balances: [],
      totalUsdValue: 0,
      shareOfPortfolio: 0,
      lastSync: new Date().toISOString(),
      sessionKeyIds: [],
    };

    this.wallets = [...this.wallets, newWallet];
    return newWallet;
  }

  private async refreshWalletFromJupiter(
    address: string,
    fallback?: WalletAccount,
  ): Promise<WalletAccount> {
    const cached = this.getCachedPortfolio(address);
    if (cached) {
      if (!fallback) {
        this.upsertWallet(cached);
      }
      return cached;
    }

    const fetched = await this.fetchPortfolioFromJupiter(address);
    if (fetched) {
      this.portfolioCache.set(address, {
        wallet: fetched,
        expiresAt: Date.now() + PORTFOLIO_CACHE_TTL_MS,
      });
      this.upsertWallet(fetched);
      return fetched;
    }

    if (fallback) {
      return fallback;
    }

    const existing = this.wallets.find((wallet) => wallet.address === address);
    if (existing) {
      return existing;
    }

    throw new NotFoundException(`Wallet ${address} was not found`);
  }

  private getCachedPortfolio(address: string): WalletAccount | null {
    const entry = this.portfolioCache.get(address);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.portfolioCache.delete(address);
      return null;
    }
    return entry.wallet;
  }

  private getCachedTransactions(address: string): JupiterTransaction[] | null {
    const entry = this.transactionCache.get(address);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.transactionCache.delete(address);
      return null;
    }
    return entry.records;
  }

  private upsertWallet(nextWallet: WalletAccount) {
    const existingIndex = this.wallets.findIndex(
      (wallet) => wallet.address === nextWallet.address,
    );
    if (existingIndex >= 0) {
      const updated = [...this.wallets];
      updated[existingIndex] = {
        ...nextWallet,
        shareOfPortfolio: updated[existingIndex].shareOfPortfolio,
      };
      this.wallets = updated;
    } else {
      this.wallets = [...this.wallets, nextWallet];
    }
  }

  private normalizeWalletBalance(token: any): WalletBalance | null {
    const mint =
      token?.address || token?.mint || token?.tokenAddress || token?.id || null;
    if (!mint) {
      return null;
    }

    const amount =
      this.toNumber(token?.amount) ??
      this.toNumber(token?.quantity) ??
      this.toNumber(token?.balance) ??
      this.toNumber(token?.tokenAmount?.uiAmount) ??
      0;
    const usdValue =
      this.toNumber(token?.usdValue) ??
      this.toNumber(token?.valueUsd) ??
      this.toNumber(token?.value) ??
      this.toNumber(token?.tokenValue) ??
      (this.toNumber(token?.pricePerToken) ?? 0) * amount;

    const symbol =
      token?.symbol ||
      token?.tokenSymbol ||
      (mint === SOL_MINT ? 'SOL' : undefined) ||
      token?.name ||
      'Token';

    return {
      tokenSymbol: symbol,
      mint,
      amount,
      usdValue: Number(usdValue?.toFixed?.(4) ?? usdValue ?? 0),
    };
  }

  private extractTokens(payload: any): any[] {
    if (Array.isArray(payload?.tokens)) {
      return payload.tokens;
    }
    if (Array.isArray(payload?.wallet?.tokens)) {
      return payload.wallet.tokens;
    }
    if (Array.isArray(payload?.data?.tokens)) {
      return payload.data.tokens;
    }
    if (Array.isArray(payload?.data?.wallet?.tokens)) {
      return payload.data.wallet.tokens;
    }
    return [];
  }

  private extractTransactions(payload: any): any[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.transactions)) {
      return payload.transactions;
    }
    if (Array.isArray(payload?.data?.transactions)) {
      return payload.data.transactions;
    }
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }
    return [];
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private toTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
    return Date.now();
  }

  private async fetchPortfolioFromJupiter(
    address: string,
  ): Promise<WalletAccount | null> {
    if (!this.jupiterApiKey) {
      this.logger.warn(
        'Jupiter API key missing; falling back to cached wallet data',
      );
      return null;
    }

    try {
      const response = await fetch(
        `${JUPITER_PORTFOLIO_ENDPOINT}/${address.trim()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.jupiterApiKey,
          },
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Jupiter portfolio API error ${response.status} for ${address}: ${body}`,
        );
        return null;
      }

      const payload = await response.json();
      const tokens = this.extractTokens(payload)
        .map((token) => this.normalizeWalletBalance(token))
        .filter(Boolean) as WalletBalance[];

      if (tokens.length === 0) {
        return null;
      }

      const totalUsdValue = Number(
        (
          payload?.totalValueUsd ??
          payload?.wallet?.totalValueUsd ??
          payload?.data?.totalValueUsd ??
          tokens.reduce((sum, balance) => sum + balance.usdValue, 0)
        ).toFixed(2),
      );

      return {
        address,
        label: address,
        provider: 'custom',
        balances: tokens,
        totalUsdValue,
        shareOfPortfolio: 0,
        lastSync: new Date().toISOString(),
        sessionKeyIds: [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch Jupiter portfolio for ${address}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  private async fetchTransactionsFromJupiter(
    address: string,
  ): Promise<JupiterTransaction[]> {
    if (!this.jupiterApiKey) {
      this.logger.warn(
        'Jupiter API key missing; cannot fetch transaction history',
      );
      return [];
    }

    try {
      const response = await fetch(JUPITER_TRANSACTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': this.jupiterApiKey,
        },
        body: JSON.stringify({
          wallet: address,
          limit: JUPITER_TRANSACTIONS_LIMIT,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Jupiter transactions API error ${response.status} for ${address}: ${body}`,
        );
        return [];
      }

      const payload = await response.json();
      return this.extractTransactions(payload)
        .map((entry) => this.normalizeTransaction(entry))
        .filter(Boolean) as JupiterTransaction[];
    } catch (error) {
      this.logger.error(
        `Failed to fetch Jupiter transactions for ${address}`,
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  private normalizeTransaction(entry: any): JupiterTransaction | null {
    const signature =
      entry?.signature ??
      entry?.txSignature ??
      entry?.transactionSignature ??
      null;
    if (!signature) {
      return null;
    }

    return {
      signature,
      timestamp: this.toTimestamp(entry?.timestamp ?? entry?.blockTime),
      type: String(entry?.type ?? entry?.action ?? 'unknown').toLowerCase(),
      description: entry?.description ?? entry?.label,
      source: entry?.platform ?? entry?.dex ?? entry?.programId ?? 'jupiter',
      pnlUsd: this.toNumber(entry?.pnlUsd),
      amountUsd:
        this.toNumber(entry?.amountUsd) ?? this.toNumber(entry?.volumeUsd),
      feeUsd: this.toNumber(entry?.feeUsd ?? entry?.feesUsd),
      raw: entry,
    };
  }
}
