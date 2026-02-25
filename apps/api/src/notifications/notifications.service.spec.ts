import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

jest.mock('expo-server-sdk', () => {
  const sendPushNotificationsAsync = jest.fn();
  const chunkPushNotifications = jest.fn((messages: any[]) => [messages]);
  const isExpoPushToken = jest.fn((token: string) =>
    token.startsWith('ExponentPushToken'),
  );

  class ExpoMock {
    static isExpoPushToken = isExpoPushToken;
    chunkPushNotifications = chunkPushNotifications;
    sendPushNotificationsAsync = sendPushNotificationsAsync;
  }

  return {
    Expo: ExpoMock,
  };
});

const getExpoMocks = () => {
  const { Expo } = jest.requireMock('expo-server-sdk');
  const instance = new Expo();
  return {
    sendPushNotificationsAsync: instance.sendPushNotificationsAsync as jest.Mock,
    chunkPushNotifications: instance.chunkPushNotifications as jest.Mock,
    isExpoPushToken: Expo.isExpoPushToken as jest.Mock,
  };
};

describe('NotificationsService', () => {
  beforeEach(() => {
    const mocks = getExpoMocks();
    mocks.sendPushNotificationsAsync.mockReset();
    mocks.chunkPushNotifications.mockClear();
    mocks.isExpoPushToken.mockClear();
  });

  it('rejects invalid Expo tokens', () => {
    const mocks = getExpoMocks();
    mocks.isExpoPushToken.mockReturnValue(false);
    const service = new NotificationsService();
    expect(() =>
      service.registerDevice({ token: 'bad', addresses: ['addr'] }),
    ).toThrow(BadRequestException);
  });

  it('registers tokens and dispatches notifications', async () => {
    const mocks = getExpoMocks();
    mocks.isExpoPushToken.mockReturnValue(true);
    mocks.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);
    const service = new NotificationsService();
    service.registerDevice({
      token: 'ExponentPushToken-1',
      addresses: ['  wallet-1 '],
    });

    await service.notifyAddressActivity('wallet-1', {
      signature: 'sig-1',
      timestamp: Date.now(),
      type: 'TRANSFER',
      balanceChanges: [
        {
          userAccount: 'wallet-1',
          amount: 1_000_000_000,
          mint: 'So11111111111111111111111111111111111111112',
        },
      ],
    });

    expect(mocks.chunkPushNotifications).toHaveBeenCalled();
    expect(mocks.sendPushNotificationsAsync).toHaveBeenCalled();
    const [payload] = mocks.sendPushNotificationsAsync.mock.calls[0];
    expect(payload[0].title).toBe('Funds received');
  });

  it('removes invalid tokens on device-not-registered errors', async () => {
    const mocks = getExpoMocks();
    mocks.isExpoPushToken.mockReturnValue(true);
    mocks.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    const service = new NotificationsService();
    service.registerDevice({
      token: 'ExponentPushToken-2',
      addresses: ['wallet-2'],
    });

    await service.notifyAddressActivity('wallet-2', {
      signature: 'sig-2',
      timestamp: Date.now(),
      type: 'TRANSFER',
      balanceChanges: [],
    });

    const addressesByToken = (service as any).addressesByToken;
    expect(addressesByToken.size).toBe(0);
  });
});
