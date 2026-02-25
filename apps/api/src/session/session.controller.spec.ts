import { SessionController } from './session.controller';

describe('SessionController', () => {
  const sessionService = {
    listSessionKeys: jest.fn(),
    getSettings: jest.fn(),
    listPolicies: jest.fn(),
    issueSessionKey: jest.fn(),
    revokeSessionKey: jest.fn(),
  };
  const silentReauthService = {
    list: jest.fn(),
    record: jest.fn(),
  };
  const transactionAuditService = {
    list: jest.fn(),
    record: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates session key list', async () => {
    const controller = new SessionController(
      sessionService as any,
      silentReauthService as any,
      transactionAuditService as any,
    );
    sessionService.listSessionKeys.mockResolvedValue([{ id: 'sk-1' }]);
    await expect(controller.listSessionKeys()).resolves.toEqual([{ id: 'sk-1' }]);
  });

  it('delegates issue and revoke', async () => {
    const controller = new SessionController(
      sessionService as any,
      silentReauthService as any,
      transactionAuditService as any,
    );
    sessionService.issueSessionKey.mockResolvedValue({ id: 'sk-1' });
    sessionService.revokeSessionKey.mockResolvedValue({ id: 'sk-1' });

    await controller.issueSessionKey({} as any);
    await controller.revokeSessionKey('sk-1', { reason: 'user_request' } as any);

    expect(sessionService.issueSessionKey).toHaveBeenCalled();
    expect(sessionService.revokeSessionKey).toHaveBeenCalledWith('sk-1', {
      reason: 'user_request',
    });
  });

  it('delegates silent reauth and audits', () => {
    const controller = new SessionController(
      sessionService as any,
      silentReauthService as any,
      transactionAuditService as any,
    );
    controller.listSilentReauthorizations();
    controller.recordSilentReauthorization({} as any);
    controller.listTransactionAudits();
    controller.recordTransactionAudit({} as any);

    expect(silentReauthService.list).toHaveBeenCalled();
    expect(silentReauthService.record).toHaveBeenCalled();
    expect(transactionAuditService.list).toHaveBeenCalled();
    expect(transactionAuditService.record).toHaveBeenCalled();
  });
});
