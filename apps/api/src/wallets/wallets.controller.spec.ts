import { WalletsController } from './wallets.controller';

describe('WalletsController', () => {
  const walletsService = {
    getAggregatedPortfolio: jest.fn(),
    getWallet: jest.fn(),
    linkWallet: jest.fn(),
  };
  const heliusService = {
    getActivity: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates portfolio and wallet lookup', async () => {
    const controller = new WalletsController(
      walletsService as any,
      heliusService as any,
    );
    walletsService.getAggregatedPortfolio.mockResolvedValue({ totalUsdValue: 1 });
    walletsService.getWallet.mockResolvedValue({ address: 'wallet-1' });

    await expect(controller.getPortfolio()).resolves.toEqual({
      totalUsdValue: 1,
    });
    await expect(controller.getWallet('wallet-1')).resolves.toEqual({
      address: 'wallet-1',
    });
  });

  it('delegates activity and link', async () => {
    const controller = new WalletsController(
      walletsService as any,
      heliusService as any,
    );
    heliusService.getActivity.mockReturnValue([{ signature: 'sig-1' }]);
    walletsService.linkWallet.mockResolvedValue({ address: 'wallet-1' });

    expect(controller.getActivity('wallet-1')).toEqual([
      { signature: 'sig-1' },
    ]);
    await expect(
      controller.linkWallet({ address: 'wallet-1', provider: 'custom' } as any),
    ).resolves.toEqual({ address: 'wallet-1' });
  });
});
