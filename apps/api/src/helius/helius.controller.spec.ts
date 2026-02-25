import { HeliusController } from './helius.controller';

describe('HeliusController', () => {
  const heliusService = {
    processWebhook: jest.fn(),
    registerAddress: jest.fn(),
    getAccountSnapshot: jest.fn(),
    getActivity: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles webhook and returns count', async () => {
    const controller = new HeliusController(heliusService as any);
    heliusService.processWebhook.mockResolvedValue(undefined);
    const result = await controller.handleWebhook([{ a: 1 }], 'sig');
    expect(heliusService.processWebhook).toHaveBeenCalledWith([{ a: 1 }], 'sig');
    expect(result).toEqual({ received: 1 });
  });

  it('delegates snapshot and activity', () => {
    const controller = new HeliusController(heliusService as any);
    heliusService.getAccountSnapshot.mockReturnValue({ snapshot: null });
    heliusService.getActivity.mockReturnValue([{ signature: 'sig-1' }]);

    expect(controller.getAccountSnapshot('wallet-1')).toEqual({
      snapshot: null,
    });
    expect(controller.getAccountActivity('wallet-1')).toEqual([
      { signature: 'sig-1' },
    ]);
  });

  it('delegates tracking', async () => {
    const controller = new HeliusController(heliusService as any);
    heliusService.registerAddress.mockResolvedValue({ address: 'wallet-1' });
    await expect(controller.trackAddress('wallet-1')).resolves.toEqual({
      address: 'wallet-1',
      snapshot: { address: 'wallet-1' },
    });
  });
});
