import { TransactionsService } from './transactions.service';

const makePrisma = () => ({
  transaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('TransactionsService', () => {
  it('handles duplicate create gracefully', async () => {
    const prisma = makePrisma();
    prisma.transaction.create.mockRejectedValue({ code: 'P2002' });
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      signature: 'sig-1',
    });
    const service = new TransactionsService(prisma as any);
    const result = await service.create({ signature: 'sig-1' } as any);
    expect(result.signature).toBe('sig-1');
  });

  it('batch creates and returns count', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([]);
    const service = new TransactionsService(prisma as any);
    const count = await service.batchCreate([
      { signature: 'sig-1' } as any,
      { signature: 'sig-2' } as any,
    ]);
    expect(count).toBe(2);
  });

  it('computes wallet statistics', async () => {
    const prisma = makePrisma();
    const service = new TransactionsService(prisma as any);
    jest
      .spyOn(service, 'findByWalletAccountId')
      .mockResolvedValue([
        {
          type: 'TRANSFER',
          status: 'SUCCESS',
          amountUsd: 10,
          feeUsd: 1,
        },
        {
          type: 'TRANSFER',
          status: 'FAILED',
          amountUsd: 5,
          feeUsd: 0.5,
        },
      ] as any);

    const stats = await service.getWalletStatistics('wallet-1', 30);
    expect(stats.total).toBe(2);
    expect(stats.byType.TRANSFER).toBe(2);
    expect(stats.byStatus.SUCCESS).toBe(1);
    expect(stats.totalVolumeUsd).toBe(15);
    expect(stats.totalFeesUsd).toBe(1.5);
  });
});
