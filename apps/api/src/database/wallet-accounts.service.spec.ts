import { WalletAccountsService } from './wallet-accounts.service';

const makePrisma = () => ({
  walletAccount: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('WalletAccountsService', () => {
  it('links new wallet when missing', async () => {
    const prisma = makePrisma();
    prisma.walletAccount.findUnique.mockResolvedValue(null);
    prisma.walletAccount.create.mockResolvedValue({
      id: 'wallet-1',
      address: 'addr',
      userId: 'user-1',
    });

    const service = new WalletAccountsService(prisma as any);
    const wallet = await service.linkWallet('user-1', 'addr', 'label');
    expect(wallet.id).toBe('wallet-1');
  });

  it('reactivates existing inactive wallet', async () => {
    const prisma = makePrisma();
    prisma.walletAccount.findUnique.mockResolvedValue({
      id: 'wallet-1',
      address: 'addr',
      userId: 'user-1',
      isActive: false,
    });
    prisma.walletAccount.update.mockResolvedValue({
      id: 'wallet-1',
      isActive: true,
    });

    const service = new WalletAccountsService(prisma as any);
    const wallet = await service.linkWallet('user-1', 'addr');
    expect(wallet.isActive).toBe(true);
  });

  it('returns statistics summary', async () => {
    const prisma = makePrisma();
    prisma.walletAccount.findMany.mockResolvedValue([
      { id: 'w1', address: 'a', isActive: true, lastBalanceUsd: 10 },
      { id: 'w2', address: 'b', isActive: false, lastBalanceUsd: 5 },
    ]);
    const service = new WalletAccountsService(prisma as any);
    const stats = await service.getStatistics('user-1');
    expect(stats.totalWallets).toBe(2);
    expect(stats.activeWallets).toBe(1);
    expect(stats.totalBalanceUsd).toBe(15);
  });
});
