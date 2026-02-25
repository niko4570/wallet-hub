import { SilentReauthorizationService } from './silent-reauthorization.service';

describe('SilentReauthorizationService', () => {
  it('records new entries and caps list size', () => {
    const service = new SilentReauthorizationService();
    for (let i = 0; i < 12; i += 1) {
      service.record({
        walletAddress: `wallet-${i}`,
        walletAppId: `app-${i}`,
        walletName: `name-${i}`,
        authToken: `token-${i}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        method: 'silent',
        capabilities: {
          supportsCloneAuthorization: false,
          supportsSignAndSendTransactions: true,
          supportsSignTransactions: true,
          supportsSignMessages: false,
          featureFlags: [],
        },
      });
    }

    const list = service.list();
    expect(list.length).toBe(10);
  });

  it('updates existing records for same wallet/app', () => {
    const service = new SilentReauthorizationService();
    const first = service.record({
      walletAddress: 'wallet-1',
      walletAppId: 'app-1',
      walletName: 'name-1',
      authToken: 'token-1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      method: 'silent',
      capabilities: {
        supportsCloneAuthorization: false,
        supportsSignAndSendTransactions: true,
        supportsSignTransactions: true,
        supportsSignMessages: false,
        featureFlags: [],
      },
    });

    const updated = service.record({
      walletAddress: 'wallet-1',
      walletAppId: 'app-1',
      walletName: 'name-1',
      authToken: 'token-2',
      expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
      method: 'silent',
      capabilities: {
        supportsCloneAuthorization: false,
        supportsSignAndSendTransactions: true,
        supportsSignTransactions: true,
        supportsSignMessages: false,
        featureFlags: [],
      },
    });

    expect(updated.id).toBe(first.id);
    expect(updated.authTokenHint).toBe('en-2');
  });
});
