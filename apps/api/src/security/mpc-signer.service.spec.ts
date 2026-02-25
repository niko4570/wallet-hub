import { BadRequestException } from '@nestjs/common';
import { MpcSignerService } from './mpc-signer.service';

describe('MpcSignerService', () => {
  it('rejects empty scopes', () => {
    const service = new MpcSignerService();
    expect(() =>
      service.authorizeAndSign({
        walletAddress: 'wallet-1',
        scopes: [],
        policy: {
          id: 'policy-1',
          walletAddress: 'wallet-1',
          maxDailySpendUsd: 100,
          maxTxPerHour: 3,
          allowedPrograms: [],
          allowedDestinations: [],
        },
        biometricConfidence: 0.9,
        expiresInMinutes: 5,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects low biometric confidence', () => {
    const service = new MpcSignerService();
    expect(() =>
      service.authorizeAndSign({
        walletAddress: 'wallet-1',
        scopes: [{ name: 'transfer', maxUsd: 10 }],
        policy: {
          id: 'policy-1',
          walletAddress: 'wallet-1',
          maxDailySpendUsd: 100,
          maxTxPerHour: 3,
          allowedPrograms: [],
          allowedDestinations: [],
        },
        biometricConfidence: 0.3,
        expiresInMinutes: 5,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects scopes that violate policy', () => {
    const service = new MpcSignerService();
    expect(() =>
      service.authorizeAndSign({
        walletAddress: 'wallet-1',
        scopes: [{ name: 'transfer', maxUsd: 200 }],
        policy: {
          id: 'policy-1',
          walletAddress: 'wallet-1',
          maxDailySpendUsd: 100,
          maxTxPerHour: 3,
          allowedPrograms: [],
          allowedDestinations: [],
        },
        biometricConfidence: 0.9,
        expiresInMinutes: 5,
      }),
    ).toThrow(BadRequestException);
  });

  it('returns signature result for valid request', () => {
    const service = new MpcSignerService();
    const result = service.authorizeAndSign({
      walletAddress: 'wallet-1',
      scopes: [{ name: 'transfer', maxUsd: 50 }],
      policy: {
        id: 'policy-1',
        walletAddress: 'wallet-1',
        maxDailySpendUsd: 100,
        maxTxPerHour: 3,
        allowedPrograms: ['program-1'],
        allowedDestinations: ['dest-1'],
      },
      biometricConfidence: 0.9,
      expiresInMinutes: 5,
    });

    expect(result.signatureId).toMatch('mpc-signature-');
    expect(result.approvals.length).toBe(2);
    expect(result.expiresAt).toBeDefined();
  });
});
