import {
  RecordSilentReauthorizationPayload,
  SilentReauthorizationRecord,
  SilentReauthorizationStatus,
  WalletCapabilityReport,
} from '@wallethub/contracts';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

const DEFAULT_CAPABILITIES: WalletCapabilityReport = {
  supportsCloneAuthorization: false,
  supportsSignAndSendTransactions: true,
  supportsSignTransactions: true,
  supportsSignMessages: false,
  featureFlags: [],
};

@Injectable()
export class SilentReauthorizationService {
  private records: SilentReauthorizationRecord[] = [
    {
      id: 'silent-backpack',
      walletAddress: 'F97p1dA1s5C3q9e7m2x1n4v6b8k0z1r3t5y7u9w1',
      walletAppId: 'backpack',
      walletName: 'Backpack Prime',
      authTokenHint: 'c9df',
      lastRefreshedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 25).toISOString(),
      status: 'fresh',
      method: 'silent',
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportsCloneAuthorization: true,
        featureFlags: ['solana:cloneAuthorization', 'solana:signTransactions'],
        supportedTransactionVersions: ['legacy', 'v0'],
        maxTransactionsPerRequest: 10,
      },
    },
    {
      id: 'silent-ledger',
      walletAddress: '7t5y3u1i9o7p5a3s2d4f6g8h0j2k4l6z8x0c2v4b6',
      walletAppId: 'ledger',
      walletName: 'Ledger Vault',
      authTokenHint: '1a7b',
      lastRefreshedAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
      status: 'stale',
      method: 'silent',
      capabilities: DEFAULT_CAPABILITIES,
    },
  ];

  list(): SilentReauthorizationRecord[] {
    return this.records;
  }

  record(
    payload: RecordSilentReauthorizationPayload,
  ): SilentReauthorizationRecord {
    const now = new Date().toISOString();
    const authTokenHint = payload.authToken?.slice(-4);
    const status = this.computeStatus(payload.expiresAt, payload.error);
    const sanitizedCapabilities = payload.capabilities ?? DEFAULT_CAPABILITIES;

    const nextRecord: SilentReauthorizationRecord = {
      id: randomUUID(),
      walletAddress: payload.walletAddress,
      walletAppId: payload.walletAppId,
      walletName: payload.walletName,
      authTokenHint,
      lastRefreshedAt: now,
      expiresAt: payload.expiresAt,
      status,
      method: payload.method,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        ...sanitizedCapabilities,
        featureFlags:
          sanitizedCapabilities.featureFlags ??
          DEFAULT_CAPABILITIES.featureFlags,
      },
      error: payload.error,
    };

    const existingIndex = this.records.findIndex(
      (record) =>
        record.walletAddress === payload.walletAddress &&
        record.walletAppId === payload.walletAppId,
    );

    if (existingIndex >= 0) {
      nextRecord.id = this.records[existingIndex].id;
      this.records[existingIndex] = nextRecord;
    } else {
      this.records = [nextRecord, ...this.records].slice(0, 10);
    }

    return nextRecord;
  }

  private computeStatus(
    expiresAt?: string,
    error?: string,
  ): SilentReauthorizationStatus {
    if (error) {
      return 'error';
    }
    if (!expiresAt) {
      return 'fresh';
    }

    const expiry = Date.parse(expiresAt);
    if (Number.isNaN(expiry)) {
      return 'fresh';
    }
    const now = Date.now();
    if (expiry <= now) {
      return 'expired';
    }
    if (expiry - now < 1000 * 60 * 10) {
      return 'stale';
    }
    return 'fresh';
  }
}
