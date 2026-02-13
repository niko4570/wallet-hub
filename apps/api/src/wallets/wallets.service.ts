import {
  AggregatedPortfolio,
  PendingAction,
  WalletAccount,
  WalletBalance,
  computeAggregatedPortfolio,
} from '@wallethub/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { InfrastructureConfigService } from '../config/infrastructure-config.service';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

interface WalletRecord {
  address: string;
  label?: string;
  provider: WalletAccount['provider'];
  sessionKeyIds: string[];
}

interface CachedPriceEntry {
  price: number;
  timestamp: number;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly infrastructureConfig: InfrastructureConfigService,
  ) {}

  private connection = new Connection(
    this.infrastructureConfig.solanaRpcUrl,
    'confirmed',
  );
  private readonly priceCache = new Map<string, CachedPriceEntry>();
  private readonly priceCacheTtlMs = 5 * 60 * 1000;

  private readonly pendingActions: PendingAction[] = [
    {
      id: 'session-rotation',
      title: 'Rotate session keys',
      description:
        'Primary device keys reach policy threshold, rotate within 12h.',
      severity: 'warning',
    },
  ];

  private wallets: WalletRecord[] = [
    {
      address: 'F97p1dA1s5C3q9e7m2x1n4v6b8k0z1r3t5y7u9w1',
      label: 'Backpack Prime',
      provider: 'backpack',
      sessionKeyIds: ['session-1'],
    },
    {
      address: '7t5y3u1i9o7p5a3s2d4f6g8h0j2k4l6z8x0c2v4b6',
      label: 'Ledger Vault',
      provider: 'ledger',
      sessionKeyIds: [],
    },
  ];

  async getAggregatedPortfolio(): Promise<AggregatedPortfolio> {
    const hydrated = await Promise.all(
      this.wallets.map((wallet) => this.buildWalletAccount(wallet)),
    );
    return computeAggregatedPortfolio(hydrated, this.pendingActions, 3.4);
  }

  async getWallet(address: string): Promise<WalletAccount> {
    const wallet = this.wallets.find((item) => item.address === address);
    if (!wallet) {
      throw new NotFoundException(`Wallet ${address} was not found`);
    }

    return await this.buildWalletAccount(wallet);
  }

  async linkWallet(payload: LinkWalletDto): Promise<WalletAccount> {
    const normalizedAddress = payload.address.trim();
    const existing = this.wallets.find(
      (wallet) => wallet.address === normalizedAddress,
    );
    if (existing) {
      return await this.buildWalletAccount(existing);
    }

    const newWallet: WalletRecord = {
      address: normalizedAddress,
      label: payload.label ?? 'New Wallet',
      provider: payload.provider,
      sessionKeyIds: [],
    };

    this.wallets = [...this.wallets, newWallet];
    return await this.buildWalletAccount(newWallet);
  }

  private async buildWalletAccount(
    wallet: WalletRecord,
  ): Promise<WalletAccount> {
    const now = new Date().toISOString();
    const balances: WalletBalance[] = [];
    let totalUsdValue = 0;

    const [solBalanceLamports, tokenAccounts] = await Promise.all([
      this.getSolBalance(wallet.address).catch(() => 0),
      this.getTokenAccounts(wallet.address).catch(() => []),
    ]);

    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;
    const solPrice = await this.getSolPriceInUsd().catch(() => 0);
    const solUsdValue = Number((solBalance * solPrice).toFixed(2));

    balances.push({
      tokenSymbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      amount: Number(solBalance.toFixed(6)),
      usdValue: solUsdValue,
    });
    totalUsdValue += solUsdValue;

    const tokensWithBalance = tokenAccounts.filter(
      (token) => token.uiAmount > 0,
    );
    const tokenPrices = await this.getTokenPricesInUsd(
      tokensWithBalance.map((token) => token.mint),
    );

    tokensWithBalance.forEach((token) => {
      const price = tokenPrices[token.mint] ?? 0;
      const usdValue = Number((token.uiAmount * price).toFixed(2));
      totalUsdValue += usdValue;
      balances.push({
        tokenSymbol: token.symbol ?? 'SPL',
        mint: token.mint,
        amount: Number(token.uiAmount.toFixed(6)),
        usdValue,
      });
    });

    return {
      address: wallet.address,
      label: wallet.label,
      provider: wallet.provider,
      balances,
      totalUsdValue: Number(totalUsdValue.toFixed(2)),
      shareOfPortfolio: 0,
      lastSync: now,
      sessionKeyIds: wallet.sessionKeyIds,
    };
  }

  private async getSolBalance(address: string): Promise<number> {
    return await this.connection.getBalance(new PublicKey(address));
  }

  private async getTokenAccounts(address: string): Promise<
    Array<{
      mint: string;
      uiAmount: number;
      symbol?: string;
    }>
  > {
    const owner = new PublicKey(address);
    const result = await this.connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    return result.value
      .map((entry) => {
        const info = entry.account.data.parsed?.info;
        const tokenAmount = info?.tokenAmount;
        const mint = info?.mint;
        if (!tokenAmount || !mint) {
          return null;
        }

        const uiAmount =
          typeof tokenAmount.uiAmount === 'number'
            ? tokenAmount.uiAmount
            : Number(tokenAmount.uiAmountString ?? '0');

        return {
          mint,
          uiAmount,
        };
      })
      .filter(
        (
          token,
        ): token is {
          mint: string;
          uiAmount: number;
          symbol?: string;
        } => token !== null,
      );
  }

  private async getSolPriceInUsd(): Promise<number> {
    const cached = this.getCachedPrice('solana');
    if (cached !== null) {
      return cached;
    }

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        method: 'GET',
        headers: this.getCoinGeckoHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(`CoinGecko price error: ${response.status}`);
    }

    const data = (await response.json()) as { solana?: { usd?: number } };
    const price = data.solana?.usd ?? 0;
    this.setCachedPrice('solana', price);
    return price;
  }

  private async getTokenPricesInUsd(
    mints: string[],
  ): Promise<Record<string, number>> {
    const uniqueMints = Array.from(
      new Set(mints.map((mint) => mint.trim()).filter(Boolean)),
    );
    if (uniqueMints.length === 0) {
      return {};
    }

    const result: Record<string, number> = {};
    const uncached: string[] = [];

    uniqueMints.forEach((mint) => {
      const cached = this.getCachedPrice(`mint:${mint}`);
      if (cached !== null) {
        result[mint] = cached;
      } else {
        uncached.push(mint);
      }
    });

    if (uncached.length === 0) {
      return result;
    }

    const chunkSize = 100;
    for (let i = 0; i < uncached.length; i += chunkSize) {
      const chunk = uncached.slice(i, i + chunkSize);
      const ids = encodeURIComponent(chunk.join(','));
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${ids}&vs_currencies=usd`,
        {
          method: 'GET',
          headers: this.getCoinGeckoHeaders(),
        },
      );
      if (!response.ok) {
        throw new Error(`CoinGecko token price error: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, { usd?: number }>;
      Object.entries(data ?? {}).forEach(([mint, entry]) => {
        const price = entry?.usd;
        if (typeof price === 'number' && Number.isFinite(price)) {
          result[mint] = price;
          this.setCachedPrice(`mint:${mint}`, price);
        }
      });
    }

    return result;
  }

  private getCoinGeckoHeaders(): Record<string, string> | undefined {
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    if (!apiKey) {
      return undefined;
    }
    return {
      'x-cg-api-key': apiKey,
    };
  }

  private getCachedPrice(key: string): number | null {
    const cached = this.priceCache.get(key);
    if (!cached) {
      return null;
    }
    if (Date.now() - cached.timestamp > this.priceCacheTtlMs) {
      this.priceCache.delete(key);
      return null;
    }
    return cached.price;
  }

  private setCachedPrice(key: string, price: number) {
    this.priceCache.set(key, { price, timestamp: Date.now() });
  }
}
