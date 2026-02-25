import { HeliusService } from './helius.service';

describe('HeliusService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('ignores malformed webhook payloads', async () => {
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    const service = new HeliusService({ heliusApiKey: 'key' } as any);
    await service.processWebhook({} as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('processes webhook events, refreshes snapshots, and notifies', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nativeBalance: { solBalance: 1.5, valueUsd: 150 },
          tokens: [
            {
              mint: 'Token1',
              symbol: 'AAA',
              balance: 2,
              usdValue: 10,
              decimals: 6,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ signature: 'sig-1', type: 'TRANSFER' }],
      });
    (global as any).fetch = fetchMock;

    const notificationsService = {
      notifyAddressActivity: jest.fn().mockResolvedValue(undefined),
    };

    const service = new HeliusService(
      { heliusApiKey: 'key' } as any,
      notificationsService as any,
    );

    await service.processWebhook([
      {
        signature: 'sig-1',
        type: 'TRANSFER',
        balanceChanges: [
          {
            userAccount: 'wallet-1',
            amount: 100,
            mint: 'Token1',
            decimals: 6,
          },
        ],
      },
    ]);

    const snapshot = service.getAccountSnapshot('wallet-1');
    expect(snapshot.snapshot?.address).toBe('wallet-1');
    expect(snapshot.activity.length).toBeGreaterThan(0);
    expect(notificationsService.notifyAddressActivity).toHaveBeenCalledWith(
      'wallet-1',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
