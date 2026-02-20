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
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly biometricVerifier: BiometricVerificationService,
    private readonly mpcSigner: MpcSignerService,
    private readonly infrastructureConfig: InfrastructureConfigService,
    private readonly prisma: PrismaService,
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
    const policies = await this.prisma.sessionPolicy.findMany();
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

    const sessionKeys = await this.prisma.sessionKey.findMany({
      include: {
        policy: true,
      },
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

    const sessionKeyData = await this.prisma.sessionKey.create({
      data: {
        walletAddress: dto.walletAddress,
        derivedPublicKey: `derived-${randomUUID()}`,
        devicePublicKey: dto.devicePublicKey,
        issuedAt: now,
        expiresAt,
        scopes: Array.isArray(dto.scopes) ? JSON.stringify(dto.scopes) : '[]',
        status: 'active',
        policyId: policy.id,
        metadata,
      },
      include: {
        policy: true,
      },
    });

    return {
      id: sessionKeyData.id,
      walletAddress: sessionKeyData.walletAddress,
      derivedPublicKey: sessionKeyData.derivedPublicKey,
      devicePublicKey: sessionKeyData.devicePublicKey,
      issuedAt: sessionKeyData.issuedAt.toISOString(),
      expiresAt: sessionKeyData.expiresAt.toISOString(),
      scopes:
        typeof sessionKeyData.scopes === 'string'
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
    const session = await this.prisma.sessionKey.findUnique({
      where: { id },
    });
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

    const updatedSession = await this.prisma.sessionKey.update({
      where: { id },
      data: {
        status: 'revoked',
        metadata: {
          ...(session.metadata as Record<string, string>),
          revokedReason: dto.reason ?? 'user_request',
        },
        lastUsedAt: new Date(),
      },
    });

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
    const existingPolicy = await this.prisma.sessionPolicy.findFirst({
      where: { walletAddress },
    });

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
    const newPolicy = await this.prisma.sessionPolicy.create({
      data: {
        walletAddress,
        maxDailySpendUsd: 500,
        maxTxPerHour: 3,
        allowedPrograms: [],
        allowedDestinations: [],
      },
    });

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
    const result = await this.prisma.sessionKey.updateMany({
      where: {
        status: 'active',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
        metadata: {
          expiredAt: now.toISOString(),
        },
      },
    });

    return result.count;
  }

  // Get active session keys for a specific wallet
  async getActiveSessionKeys(walletAddress: string): Promise<SessionKey[]> {
    const now = new Date();
    const sessionKeys = await this.prisma.sessionKey.findMany({
      where: {
        walletAddress,
        status: 'active',
        expiresAt: {
          gte: now,
        },
      },
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

  // Check if a session key is valid (active and not expired)
  async isSessionKeyValid(sessionKeyId: string): Promise<boolean> {
    const now = new Date();
    const sessionKey = await this.prisma.sessionKey.findUnique({
      where: {
        id: sessionKeyId,
      },
    });

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
    const sessionKey = await this.prisma.sessionKey.findUnique({
      where: {
        id: sessionKeyId,
      },
      include: {
        policy: true,
      },
    });

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
    await this.prisma.sessionKey.update({
      where: { id: sessionKeyId },
      data: {
        lastUsedAt: now,
      },
    });

    return { valid: true };
  }

  // Get session key details with policy
  async getSessionKeyDetails(sessionKeyId: string): Promise<{
    sessionKey: SessionKey;
    policy: SessionPolicy;
  } | null> {
    const sessionKeyWithPolicy = await this.prisma.sessionKey.findUnique({
      where: {
        id: sessionKeyId,
      },
      include: {
        policy: true,
      },
    });

    if (!sessionKeyWithPolicy || !sessionKeyWithPolicy.policy) {
      return null;
    }

    return {
      sessionKey: {
        id: sessionKeyWithPolicy.id,
        walletAddress: sessionKeyWithPolicy.walletAddress,
        derivedPublicKey: sessionKeyWithPolicy.derivedPublicKey,
        devicePublicKey: sessionKeyWithPolicy.devicePublicKey,
        issuedAt: sessionKeyWithPolicy.issuedAt.toISOString(),
        expiresAt: sessionKeyWithPolicy.expiresAt.toISOString(),
        scopes:
          typeof sessionKeyWithPolicy.scopes === 'string'
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
        id: sessionKeyWithPolicy.policy.id,
        walletAddress: sessionKeyWithPolicy.policy.walletAddress,
        maxDailySpendUsd: Number(sessionKeyWithPolicy.policy.maxDailySpendUsd),
        maxTxPerHour: sessionKeyWithPolicy.policy.maxTxPerHour,
        allowedPrograms: sessionKeyWithPolicy.policy
          .allowedPrograms as string[],
        allowedDestinations: sessionKeyWithPolicy.policy
          .allowedDestinations as string[],
      },
    };
  }

  // Revoke all session keys for a wallet
  async revokeAllSessionKeys(walletAddress: string): Promise<number> {
    const result = await this.prisma.sessionKey.updateMany({
      where: {
        walletAddress,
        status: 'active',
      },
      data: {
        status: 'revoked',
        metadata: {
          revokedReason: 'wallet_revocation',
          revokedAt: new Date().toISOString(),
        },
        lastUsedAt: new Date(),
      },
    });

    this.logger.log(
      `Revoked ${result.count} session keys for wallet ${walletAddress}`,
    );
    return result.count;
  }
}
