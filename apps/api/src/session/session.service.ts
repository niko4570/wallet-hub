import { SessionKey, SessionPolicy } from '@wallethub/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IssueSessionKeyDto } from './dto/issue-session-key.dto';
import { RevokeSessionKeyDto } from './dto/revoke-session-key.dto';
import { BiometricVerificationService } from '../security/biometric-verification.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly biometricVerifier: BiometricVerificationService,
  ) {}
  private readonly policies: SessionPolicy[] = [
    {
      id: 'policy-primary',
      walletAddress: 'F97p1dA1s5C3q9e7m2x1n4v6b8k0z1r3t5y7u9w1',
      maxDailySpendUsd: 2500,
      maxTxPerHour: 10,
      allowedPrograms: [
        '11111111111111111111111111111111',
        'JUP4Fb2cqiRUznZY1rY6kQzFfj3GX4T1J8YcbD3JhC',
      ],
      allowedDestinations: [],
    },
    {
      id: 'policy-ledger',
      walletAddress: '7t5y3u1i9o7p5a3s2d4f6g8h0j2k4l6z8x0c2v4b6',
      maxDailySpendUsd: 10000,
      maxTxPerHour: 5,
      allowedPrograms: [],
      allowedDestinations: [],
    },
  ];

  private sessionKeys: SessionKey[] = [
    {
      id: 'session-1',
      walletAddress: this.policies[0].walletAddress,
      derivedPublicKey: 'Sess1DerivedKey',
      devicePublicKey: 'DeviceKeyPrimary',
      issuedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
      scopes: [
        {
          name: 'transfer',
          maxUsd: 1500,
        },
      ],
      status: 'active',
      policyId: 'policy-primary',
      metadata: {
        device: 'Saga Pro',
      },
    },
  ];

  listPolicies() {
    return this.policies;
  }

  listSessionKeys(): SessionKey[] {
    return this.sessionKeys;
  }

  issueSessionKey(dto: IssueSessionKeyDto): SessionKey {
    const biometricVerification = this.biometricVerifier.verifyProof(
      dto.biometricProof,
      {
        walletAddress: dto.walletAddress,
        devicePublicKey: dto.devicePublicKey,
      },
    );
    const policy =
      this.policies.find((item) => item.walletAddress === dto.walletAddress) ??
      this.createEphemeralPolicy(dto.walletAddress);

    const now = Date.now();
    const metadata: Record<string, string> = {
      ...(dto.metadata ?? {}),
      biometricMethod: biometricVerification.method,
      biometricConfidence: biometricVerification.confidence.toString(),
      biometricIssuedAt: biometricVerification.issuedAt,
    };
    if (biometricVerification.deviceId) {
      metadata.biometricDeviceId = biometricVerification.deviceId;
    }

    const sessionKey: SessionKey = {
      id: randomUUID(),
      walletAddress: dto.walletAddress,
      derivedPublicKey: `derived-${randomUUID()}`,
      devicePublicKey: dto.devicePublicKey,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + dto.expiresInMinutes * 60 * 1000).toISOString(),
      scopes: dto.scopes,
      status: 'active',
      policyId: policy.id,
      metadata,
    };

    this.sessionKeys = [sessionKey, ...this.sessionKeys];
    return sessionKey;
  }

  revokeSessionKey(id: string, dto: RevokeSessionKeyDto): SessionKey {
    const session = this.sessionKeys.find((key) => key.id === id);
    if (!session) {
      throw new NotFoundException(`Session key ${id} not found`);
    }

    if (session.status === 'revoked') {
      return session;
    }

    session.status = 'revoked';
    session.metadata = {
      ...(session.metadata ?? {}),
      revokedReason: dto.reason ?? 'user_request',
    };
    session.lastUsedAt = new Date().toISOString();

    return session;
  }

  private createEphemeralPolicy(walletAddress: string): SessionPolicy {
    const policy: SessionPolicy = {
      id: randomUUID(),
      walletAddress,
      maxDailySpendUsd: 500,
      maxTxPerHour: 3,
      allowedPrograms: [],
      allowedDestinations: [],
    };

    this.policies.push(policy);
    return policy;
  }
}
