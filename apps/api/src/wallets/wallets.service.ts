import {
  AggregatedPortfolio,
  PendingAction,
  WalletAccount,
  computeAggregatedPortfolio,
} from '@wallethub/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { LinkWalletDto } from './dto/link-wallet.dto';

@Injectable()
export class WalletsService {
  private readonly pendingActions: PendingAction[] = [
    {
      id: 'session-rotation',
      title: 'Rotate session keys',
      description: 'Primary device keys reach policy threshold, rotate within 12h.',
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
    return computeAggregatedPortfolio(this.wallets, this.pendingActions, 3.4);
  }

  async getWallet(address: string): Promise<WalletAccount> {
    const wallet = this.wallets.find((item) => item.address === address);
    if (!wallet) {
      throw new NotFoundException(`Wallet ${address} was not found`);
    }

    return wallet;
  }

  async linkWallet(payload: LinkWalletDto): Promise<WalletAccount> {
    const normalizedAddress = payload.address.trim();
    const existing = this.wallets.find((wallet) => wallet.address === normalizedAddress);
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
}
