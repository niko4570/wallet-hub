import {
  SessionKey,
  SessionPolicy,
  SessionKeySettings,
} from '@wallethub/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { IssueSessionKeyDto } from './dto/issue-session-key.dto';
import { RevokeSessionKeyDto } from './dto/revoke-session-key.dto';
import { BiometricVerificationService } from '../security/biometric-verification.service';
import { MpcSignerService } from '../security/mpc-signer.service';
import { InfrastructureConfigService } from '../config/infrastructure-config.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  // In-memory stores to replace Prisma-backed persistence
  private readonly sessionPolicies = new Map<string, any>();
  private readonly sessionKeys = new Map<string, any>();

  constructor(
    private readonly biometricVerifier: BiometricVerificationService,
    private readonly mpcSigner: MpcSignerService,
    private readonly infrastructureConfig: InfrastructureConfigService,
  ) {}
  private get sessionKeysEnabled(): boolean {
    return this.infrastructureConfig.sessionKeysEnabled;
  }

  // Cron job to clean up expired session keys every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    try {
      this.logger.debug('Running session key cleanup cron job');
      const cleanedCount = await this.cleanupExpiredSessionKeys();
      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired session keys`);
      }
    } catch (error) {
      this.logger.error('Error during session key cleanup:', error);
    }
  }

  async listPolicies(): Promise<SessionPolicy[]> {
    const policies = Array.from(this.sessionPolicies.values());
    return policies.map((policy: any) => ({
      id: policy.id,
      walletAddress: policy.walletAddress,
      maxDailySpendUsd: Number(policy.maxDailySpendUsd),
      maxTxPerHour: policy.maxTxPerHour,
      allowedPrograms: policy.allowedPrograms as string[],
      allowedDestinations: policy.allowedDestinations as string[],
    }));
  }

  async listSessionKeys(): Promise<SessionKey[]> {
    if (!this.sessionKeysEnabled) {
      return [];
    }

    const sessionKeys = Array.from(this.sessionKeys.values()).map((k: any) => {
      const clone = { ...k };
      if (clone.policyId) {
        clone.policy = this.sessionPolicies.get(clone.policyId) ?? null;
      }
      return clone;
    });

    return sessionKeys.map((key: any) => ({
      id: key.id,
      walletAddress: key.walletAddress,
      derivedPublicKey: key.derivedPublicKey,
      devicePublicKey: key.devicePublicKey,
      issuedAt: key.issuedAt.toISOString(),
      expiresAt: key.expiresAt.toISOString(),
      scopes: key.scopes,
      status: key.status,
      policyId: key.policyId,
      metadata: key.metadata as Record<string, string> | undefined,
      lastUsedAt: key.lastUsedAt?.toISOString(),
    }));
  }

  async issueSessionKey(dto: IssueSessionKeyDto): Promise<SessionKey> {
    this.ensureSessionKeysEnabled();
    const policy = await this.findOrCreatePolicy(dto.walletAddress);

    const biometricVerification = this.biometricVerifier.verifyProof(
      dto.biometricProof,
      {
        walletAddress: dto.walletAddress,
        devicePublicKey: dto.devicePublicKey,
      },
    );

    const signature = this.mpcSigner.authorizeAndSign({
      walletAddress: dto.walletAddress,
      scopes: dto.scopes,
      policy,
      biometricConfidence: biometricVerification.confidence,
      expiresInMinutes: dto.expiresInMinutes,
    });

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + dto.expiresInMinutes * 60 * 1000,
    );
    const metadata: Record<string, string> = {
      ...(dto.metadata ?? {}),
      biometricMethod: biometricVerification.method,
      biometricConfidence: biometricVerification.confidence.toString(),
      biometricIssuedAt: biometricVerification.issuedAt,
      mpcSignatureId: signature.signatureId,
      mpcApprovals: JSON.stringify(signature.approvals),
      mpcExpiresAt: signature.expiresAt,
    };
    if (biometricVerification.deviceId) {
      metadata.biometricDeviceId = biometricVerification.deviceId;
    }

    const id = `sk_${randomUUID()}`;
    const sessionKeyData = {
      id,
      walletAddress: dto.walletAddress,
      derivedPublicKey: `derived-${randomUUID()}`,
      devicePublicKey: dto.devicePublicKey,
      issuedAt: now,
      expiresAt,
      scopes: Array.isArray(dto.scopes) ? dto.scopes : [],
      status: 'active',
      policyId: policy.id,
      metadata,
      lastUsedAt: null,
    } as any;
    this.sessionKeys.set(id, sessionKeyData);
    // attach policy for return compatibility
    (sessionKeyData as any).policy =
      this.sessionPolicies.get(policy.id) ?? null;

    return {
      id: sessionKeyData.id,
      walletAddress: sessionKeyData.walletAddress,
      derivedPublicKey: sessionKeyData.derivedPublicKey,
      devicePublicKey: sessionKeyData.devicePublicKey,
      issuedAt: sessionKeyData.issuedAt.toISOString(),
      expiresAt: sessionKeyData.expiresAt.toISOString(),
      scopes: Array.isArray(sessionKeyData.scopes)
        ? sessionKeyData.scopes
        : typeof sessionKeyData.scopes === 'string'
          ? JSON.parse(sessionKeyData.scopes)
          : [],
      status: sessionKeyData.status as 'active' | 'revoked' | 'expired',
      policyId: sessionKeyData.policyId,
      metadata: sessionKeyData.metadata as unknown as
        | Record<string, string>
        | undefined,
      lastUsedAt: sessionKeyData.lastUsedAt?.toISOString(),
    };
  }

  async revokeSessionKey(
    id: string,
    dto: RevokeSessionKeyDto,
  ): Promise<SessionKey> {
    this.ensureSessionKeysEnabled();
    const session = this.sessionKeys.get(id) ?? null;
    if (!session) {
      throw new NotFoundException(`Session key ${id} not found`);
    }

    if (session.status === 'revoked') {
      return {
        id: session.id,
        walletAddress: session.walletAddress,
        derivedPublicKey: session.derivedPublicKey,
        devicePublicKey: session.devicePublicKey,
        issuedAt: session.issuedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        scopes:
          typeof session.scopes === 'string' ? JSON.parse(session.scopes) : [],
        status: session.status as 'active' | 'revoked' | 'expired',
        policyId: session.policyId,
        metadata: session.metadata as unknown as
          | Record<string, string>
          | undefined,
        lastUsedAt: session.lastUsedAt?.toISOString(),
      };
    }

    const updatedSession = { ...session };
    updatedSession.status = 'revoked';
    updatedSession.metadata = {
      ...(session.metadata as Record<string, string>),
      revokedReason: dto.reason ?? 'user_request',
    } as any;
    updatedSession.lastUsedAt = new Date();
    this.sessionKeys.set(id, updatedSession);

    return {
      id: updatedSession.id,
      walletAddress: updatedSession.walletAddress,
      derivedPublicKey: updatedSession.derivedPublicKey,
      devicePublicKey: updatedSession.devicePublicKey,
      issuedAt: updatedSession.issuedAt.toISOString(),
      expiresAt: updatedSession.expiresAt.toISOString(),
      scopes:
        typeof updatedSession.scopes === 'string'
          ? JSON.parse(updatedSession.scopes)
          : [],
      status: updatedSession.status as 'active' | 'revoked' | 'expired',
      policyId: updatedSession.policyId,
      metadata: updatedSession.metadata as unknown as
        | Record<string, string>
        | undefined,
      lastUsedAt: updatedSession.lastUsedAt?.toISOString(),
    };
  }

  getSettings(): SessionKeySettings {
    return {
      enabled: this.sessionKeysEnabled,
      message: this.sessionKeysEnabled
        ? 'Session key issuance is active for this environment.'
        : 'Session keys are disabled by default. Set SESSION_KEYS_ENABLED=true to re-enable legacy signing.',
    };
  }

  private async findOrCreatePolicy(
    walletAddress: string,
  ): Promise<SessionPolicy> {
    // First try to find an existing policy
    const existingPolicy = Array.from(this.sessionPolicies.values()).find(
      (p: any) => p.walletAddress === walletAddress,
    );

    if (existingPolicy) {
      return {
        id: existingPolicy.id,
        walletAddress: existingPolicy.walletAddress,
        maxDailySpendUsd: Number(existingPolicy.maxDailySpendUsd),
        maxTxPerHour: existingPolicy.maxTxPerHour,
        allowedPrograms: existingPolicy.allowedPrograms as string[],
        allowedDestinations: existingPolicy.allowedDestinations as string[],
      };
    }

    // Create a new ephemeral policy
    const id = `sp_${randomUUID()}`;
    const newPolicy = {
      id,
      walletAddress,
      maxDailySpendUsd: 500,
      maxTxPerHour: 3,
      allowedPrograms: [],
      allowedDestinations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    this.sessionPolicies.set(id, newPolicy);

    return {
      id: newPolicy.id,
      walletAddress: newPolicy.walletAddress,
      maxDailySpendUsd: Number(newPolicy.maxDailySpendUsd),
      maxTxPerHour: newPolicy.maxTxPerHour,
      allowedPrograms: newPolicy.allowedPrograms as string[],
      allowedDestinations: newPolicy.allowedDestinations as string[],
    };
  }

  private ensureSessionKeysEnabled() {
    if (!this.sessionKeysEnabled) {
      throw new BadRequestException(
        'Session keys are disabled. Set SESSION_KEYS_ENABLED=true to re-enable issuance.',
      );
    }
  }

  // Check and clean up expired session keys
  async cleanupExpiredSessionKeys(): Promise<number> {
    const now = new Date();

    // Update expired session keys to 'expired' status
    let count = 0;
    for (const [k, v] of this.sessionKeys.entries()) {
      if (v.status === 'active' && new Date(v.expiresAt) < now) {
        const updated = { ...v };
        updated.status = 'expired';
        updated.metadata = {
          ...(v.metadata ?? {}),
          expiredAt: now.toISOString(),
        };
        this.sessionKeys.set(k, updated);
        count++;
      }
    }
    return count;
  }

  // Get active session keys for a specific wallet
  async getActiveSessionKeys(walletAddress: string): Promise<SessionKey[]> {
    const now = new Date();
    const sessionKeys = Array.from(this.sessionKeys.values()).filter(
      (k: any) =>
        k.walletAddress === walletAddress &&
        k.status === 'active' &&
        new Date(k.expiresAt) >= now,
    );

    return sessionKeys.map((key: any) => ({
      id: key.id,
      walletAddress: key.walletAddress,
      derivedPublicKey: key.derivedPublicKey,
      devicePublicKey: key.devicePublicKey,
      issuedAt: key.issuedAt.toISOString(),
      expiresAt: key.expiresAt.toISOString(),
      scopes: key.scopes,
      status: key.status,
      policyId: key.policyId,
      metadata: key.metadata as Record<string, string> | undefined,
      lastUsedAt: key.lastUsedAt?.toISOString(),
    }));
  }

  // Check if a session key is valid (active and not expired)
  async isSessionKeyValid(sessionKeyId: string): Promise<boolean> {
    const now = new Date();
    const sessionKey = this.sessionKeys.get(sessionKeyId) ?? null;

    return (
      !!sessionKey &&
      sessionKey.status === 'active' &&
      sessionKey.expiresAt >= now
    );
  }

  // Verify session key with permissions check
  async verifySessionKeyWithPermissions(
    sessionKeyId: string,
    requiredPermissions: {
      maxAmountUsd?: number;
      requiredScopes?: string[];
      programId?: string;
      destinationAddress?: string;
    },
  ): Promise<{ valid: boolean; reason?: string }> {
    const now = new Date();

    // Get session key with policy
    const sessionKey = this.sessionKeys.get(sessionKeyId) ?? null;
    if (sessionKey && sessionKey.policyId) {
      (sessionKey as any).policy =
        this.sessionPolicies.get(sessionKey.policyId) ?? null;
    }

    // Check if session key exists and is active
    if (!sessionKey) {
      return { valid: false, reason: 'Session key not found' };
    }

    if (sessionKey.status !== 'active') {
      return { valid: false, reason: `Session key is ${sessionKey.status}` };
    }

    if (sessionKey.expiresAt < now) {
      return { valid: false, reason: 'Session key has expired' };
    }

    // Check policy restrictions
    if (sessionKey.policy) {
      // Check max amount
      if (requiredPermissions.maxAmountUsd) {
        const maxAmount = new Decimal(requiredPermissions.maxAmountUsd);
        const dailyLimit = new Decimal(
          Number(sessionKey.policy.maxDailySpendUsd),
        );
        if (maxAmount.greaterThan(dailyLimit)) {
          return {
            valid: false,
            reason: `Amount exceeds daily limit of ${dailyLimit.toNumber()} USD`,
          };
        }
      }

      // Check required scopes
      if (
        requiredPermissions.requiredScopes &&
        requiredPermissions.requiredScopes.length > 0
      ) {
        const sessionScopes = (sessionKey.scopes as any[]) || [];
        const scopeNames = sessionScopes.map((scope) => scope.name);

        for (const requiredScope of requiredPermissions.requiredScopes) {
          if (!scopeNames.includes(requiredScope)) {
            return {
              valid: false,
              reason: `Missing required scope: ${requiredScope}`,
            };
          }
        }
      }

      // Check allowed programs
      if (requiredPermissions.programId) {
        const allowedPrograms =
          (sessionKey.policy.allowedPrograms as string[]) || [];
        if (
          allowedPrograms.length > 0 &&
          !allowedPrograms.includes(requiredPermissions.programId)
        ) {
          return {
            valid: false,
            reason: `Program ${requiredPermissions.programId} is not allowed`,
          };
        }
      }

      // Check allowed destinations
      if (requiredPermissions.destinationAddress) {
        const allowedDestinations =
          (sessionKey.policy.allowedDestinations as string[]) || [];
        if (
          allowedDestinations.length > 0 &&
          !allowedDestinations.includes(requiredPermissions.destinationAddress)
        ) {
          return {
            valid: false,
            reason: `Destination address is not allowed`,
          };
        }
      }
    }

    // Update last used timestamp
    const sk = this.sessionKeys.get(sessionKeyId) ?? null;
    if (sk) {
      sk.lastUsedAt = now;
      this.sessionKeys.set(sessionKeyId, sk);
    }

    return { valid: true };
  }

  // Get session key details with policy
  async getSessionKeyDetails(sessionKeyId: string): Promise<{
    sessionKey: SessionKey;
    policy: SessionPolicy;
  } | null> {
    const sessionKeyWithPolicy = this.sessionKeys.get(sessionKeyId) ?? null;
    if (!sessionKeyWithPolicy) return null;
    const policy = sessionKeyWithPolicy.policyId
      ? this.sessionPolicies.get(sessionKeyWithPolicy.policyId)
      : null;
    if (!policy) return null;

    return {
      sessionKey: {
        id: sessionKeyWithPolicy.id,
        walletAddress: sessionKeyWithPolicy.walletAddress,
        derivedPublicKey: sessionKeyWithPolicy.derivedPublicKey,
        devicePublicKey: sessionKeyWithPolicy.devicePublicKey,
        issuedAt: sessionKeyWithPolicy.issuedAt.toISOString(),
        expiresAt: sessionKeyWithPolicy.expiresAt.toISOString(),
        scopes: Array.isArray(sessionKeyWithPolicy.scopes)
          ? sessionKeyWithPolicy.scopes
          : typeof sessionKeyWithPolicy.scopes === 'string'
            ? JSON.parse(sessionKeyWithPolicy.scopes)
            : [],
        status: sessionKeyWithPolicy.status as 'active' | 'revoked' | 'expired',
        policyId: sessionKeyWithPolicy.policyId,
        metadata: sessionKeyWithPolicy.metadata as unknown as
          | Record<string, string>
          | undefined,
        lastUsedAt: sessionKeyWithPolicy.lastUsedAt?.toISOString(),
      },
      policy: {
        id: policy.id,
        walletAddress: policy.walletAddress,
        maxDailySpendUsd: Number(policy.maxDailySpendUsd),
        maxTxPerHour: policy.maxTxPerHour,
        allowedPrograms: policy.allowedPrograms as string[],
        allowedDestinations: policy.allowedDestinations as string[],
      },
    };
  }

  // Revoke all session keys for a wallet
  async revokeAllSessionKeys(walletAddress: string): Promise<number> {
    let count = 0;
    for (const [k, v] of this.sessionKeys.entries()) {
      if (v.walletAddress === walletAddress && v.status === 'active') {
        const updated = { ...v };
        updated.status = 'revoked';
        updated.metadata = {
          ...(v.metadata ?? {}),
          revokedReason: 'wallet_revocation',
          revokedAt: new Date().toISOString(),
        };
        updated.lastUsedAt = new Date();
        this.sessionKeys.set(k, updated);
        count++;
      }
    }

    this.logger.log(
      `Revoked ${count} session keys for wallet ${walletAddress}`,
    );
    return count;
  }
}
