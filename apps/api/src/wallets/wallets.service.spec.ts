import { NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  const originalEnv = process.env;
  const address = 'TestWallet123';

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns aggregated portfolio using cached wallets when API key missing', async () => {
    process.env.JUPITER_API_KEY = '';
    const service = new WalletsService();
    const result = await service.getAggregatedPortfolio();
    expect(result.wallets.length).toBeGreaterThan(0);
    expect(result.pendingActions.length).toBe(1);
    const total = result.wallets.reduce(
      (sum, wallet) => sum + wallet.totalUsdValue,
      0,
    );
    expect(result.totalUsdValue).toBe(Number(total.toFixed(2)));
    result.wallets.forEach((wallet) => {
      expect(wallet.shareOfPortfolio).toBeGreaterThan(0);
    });
  });

  it('throws when wallet is not found', async () => {
    process.env.JUPITER_API_KEY = '';
    const service = new WalletsService();
    await expect(service.getWallet('missing-wallet')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('links wallet and avoids duplicates', () => {
    const service = new WalletsService();
    const first = service.linkWallet({
      address: 'NewWallet',
      provider: 'custom',
      label: 'My Wallet',
    });
    const second = service.linkWallet({
      address: 'NewWallet',
      provider: 'custom',
    });
    expect(second.address).toBe(first.address);
  });

  it('uses cached Jupiter portfolio within TTL', async () => {
    process.env.JUPITER_API_KEY = 'key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalValueUsd: 4,
        tokens: [
          {
            address: 'Mint1',
            symbol: 'AAA',
            amount: 2,
            usdValue: 4,
          },
        ],
      }),
    });
    (global as any).fetch = fetchMock;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const service = new WalletsService();
    const first = await service.getWallet(address);
    const second = await service.getWallet(address);

    expect(first.address).toBe(address);
    expect(second.address).toBe(address);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
