import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const notificationsService = {
    registerDevice: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates registration', () => {
    const controller = new NotificationsController(
      notificationsService as any,
    );
    notificationsService.registerDevice.mockReturnValue({ token: 't' });
    const result = controller.register({ token: 't', addresses: [] } as any);
    expect(result).toEqual({ token: 't' });
    expect(notificationsService.registerDevice).toHaveBeenCalledWith({
      token: 't',
      addresses: [],
    });
  });
});
