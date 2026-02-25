import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';

const makePrisma = () => ({
  sessionPolicy: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  sessionKey: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('SessionService', () => {
  let service: SessionService;
  let prisma: ReturnType<typeof makePrisma>;
  let sessionKeysEnabled = true;

  const biometricVerifier = {
    verifyProof: jest.fn(),
  };
  const mpcSigner = {
    authorizeAndSign: jest.fn(),
  };
  const infraConfig = {
    get sessionKeysEnabled() {
      return sessionKeysEnabled;
    },
  };

  beforeEach(() => {
    prisma = makePrisma();
    sessionKeysEnabled = true;
    biometricVerifier.verifyProof.mockReset();
    mpcSigner.authorizeAndSign.mockReset();
    service = new SessionService(
      biometricVerifier as any,
      mpcSigner as any,
      infraConfig as any,
      prisma as any,
    );
  });

  it('returns empty session keys when disabled', async () => {
    sessionKeysEnabled = false;
    const result = await service.listSessionKeys();
    expect(result).toEqual([]);
    expect(prisma.sessionKey.findMany).not.toHaveBeenCalled();
  });

  it('issues session keys with biometric + MPC metadata', async () => {
    prisma.sessionPolicy.findFirst.mockResolvedValue({
      id: 'policy-1',
      walletAddress: 'wallet-1',
      maxDailySpendUsd: 500,
      maxTxPerHour: 3,
      allowedPrograms: [],
      allowedDestinations: [],
    });
    biometricVerifier.verifyProof.mockReturnValue({
      method: 'face',
      confidence: 0.97,
      issuedAt: '2025-01-01T00:00:00.000Z',
      deviceId: 'device-1',
    });
    mpcSigner.authorizeAndSign.mockReturnValue({
      signatureId: 'sig-1',
      approvals: ['policy-check'],
      expiresAt: '2025-01-01T00:10:00.000Z',
    });

    prisma.sessionKey.create.mockResolvedValue({
      id: 'sk-1',
      walletAddress: 'wallet-1',
      derivedPublicKey: 'derived-123',
      devicePublicKey: 'device-pub',
      issuedAt: new Date('2025-01-01T00:00:00.000Z'),
      expiresAt: new Date('2025-01-01T00:10:00.000Z'),
      scopes: JSON.stringify([{ name: 'transfer' }]),
      status: 'active',
      policyId: 'policy-1',
      metadata: { hello: 'world' },
      lastUsedAt: null,
    });

    const result = await service.issueSessionKey({
      walletAddress: 'wallet-1',
      devicePublicKey: 'device-pub',
      biometricProof: 'proof',
      scopes: [{ name: 'transfer' }],
      expiresInMinutes: 10,
      metadata: { hello: 'world' },
    });

    expect(result.id).toBe('sk-1');
    expect(result.status).toBe('active');
    expect(prisma.sessionKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            mpcSignatureId: 'sig-1',
            biometricDeviceId: 'device-1',
          }),
        }),
      }),
    );
  });

  it('throws when revoking a missing session key', async () => {
    prisma.sessionKey.findUnique.mockResolvedValue(null);
    await expect(
      service.revokeSessionKey('missing', { reason: 'user_request' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns already revoked session key without update', async () => {
    prisma.sessionKey.findUnique.mockResolvedValue({
      id: 'sk-1',
      walletAddress: 'wallet-1',
      derivedPublicKey: 'derived-1',
      devicePublicKey: 'device-1',
      issuedAt: new Date('2025-01-01T00:00:00.000Z'),
      expiresAt: new Date('2025-01-01T00:10:00.000Z'),
      scopes: JSON.stringify([{ name: 'transfer' }]),
      status: 'revoked',
      policyId: 'policy-1',
      metadata: {},
      lastUsedAt: null,
    });

    const result = await service.revokeSessionKey('sk-1', {});
    expect(result.status).toBe('revoked');
    expect(prisma.sessionKey.update).not.toHaveBeenCalled();
  });

  it('validates required scopes and updates last used', async () => {
    prisma.sessionKey.findUnique.mockResolvedValueOnce({
      id: 'sk-1',
      walletAddress: 'wallet-1',
      derivedPublicKey: 'derived-1',
      devicePublicKey: 'device-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      scopes: [{ name: 'transfer' }],
      status: 'active',
      policyId: 'policy-1',
      policy: {
        maxDailySpendUsd: 500,
        allowedPrograms: [],
        allowedDestinations: [],
      },
    });

    const result = await service.verifySessionKeyWithPermissions('sk-1', {
      requiredScopes: ['swap'],
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch('Missing required scope');
    expect(prisma.sessionKey.update).not.toHaveBeenCalled();
  });

  it('returns valid when checks pass and updates lastUsedAt', async () => {
    prisma.sessionKey.findUnique.mockResolvedValueOnce({
      id: 'sk-1',
      walletAddress: 'wallet-1',
      derivedPublicKey: 'derived-1',
      devicePublicKey: 'device-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      scopes: [{ name: 'transfer' }],
      status: 'active',
      policyId: 'policy-1',
      policy: {
        maxDailySpendUsd: 500,
        allowedPrograms: ['program-1'],
        allowedDestinations: ['dest-1'],
      },
    });

    const result = await service.verifySessionKeyWithPermissions('sk-1', {
      maxAmountUsd: 100,
      requiredScopes: ['transfer'],
      programId: 'program-1',
      destinationAddress: 'dest-1',
    });

    expect(result.valid).toBe(true);
    expect(prisma.sessionKey.update).toHaveBeenCalledWith({
      where: { id: 'sk-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('throws when session keys are disabled for issuance', async () => {
    sessionKeysEnabled = false;
    await expect(
      service.issueSessionKey({
        walletAddress: 'wallet-1',
        devicePublicKey: 'device',
        biometricProof: 'proof',
        scopes: [],
        expiresInMinutes: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
