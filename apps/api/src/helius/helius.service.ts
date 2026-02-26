import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InfrastructureConfigService } from '../config/infrastructure-config.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface HeliusWebhookBalanceChange {
  userAccount: string;
  changeType: string;
  amount: number;
  mint?: string;
  decimals?: number;
  toUserAccount?: string;
  fromUserAccount?: string;
  owner?: string;
}

export interface HeliusWebhookTransaction {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  fee?: number;
  source?: string;
  ingestedAt?: number;
  balanceChanges?: HeliusWebhookBalanceChange[];
  raw?: Record<string, any>;
}

export interface HeliusTokenSnapshot {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  usdValue: number;
  decimals: number;
}

export interface HeliusAccountSnapshot {
  address: string;
  balance: number;
  usdValue: number;
  lastUpdated: string;
  tokens: HeliusTokenSnapshot[];
}

const DEFAULT_HELIUS_API_BASE = 'https://api.helius.xyz';
const LAMPORTS_PER_SOL = 1_000_000_000;

@Injectable()
export class HeliusService {
  private readonly logger = new Logger(HeliusService.name);
  private readonly activityByAddress = new Map<
    string,
    HeliusWebhookTransaction[]
  >();
  private readonly snapshotByAddress = new Map<string, HeliusAccountSnapshot>();
  private readonly trackedAddresses = new Set<string>();
  private readonly maxEventsPerAddress = 50;
  private readonly heliusApiBase: string;

  constructor(
    private readonly infraConfig: InfrastructureConfigService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {
    const configuredBase = process.env.HELIUS_API_BASE?.trim();
    this.heliusApiBase =
      configuredBase && configuredBase.length > 0
        ? configuredBase.replace(/\/$/, '')
        : DEFAULT_HELIUS_API_BASE;
  }

  async processWebhook(payload: any[], signature?: string) {
    if (!Array.isArray(payload)) {
      this.logger.warn('Received malformed Helius payload');
      return;
    }

    const touchedAddresses = new Set<string>();

    payload.forEach((event) => {
      const tx: HeliusWebhookTransaction = {
        signature: event?.signature ?? event?.txSignature ?? 'unknown',
        timestamp: event?.timestamp ?? Date.now() / 1000,
        type: event?.type ?? 'UNKNOWN',
        description: event?.description,
        fee: event?.fee,
        source: event?.source,
        ingestedAt: Date.now(),
        balanceChanges: event?.nativeTransfers ?? event?.balanceChanges,
        raw: event,
      };

      const addresses = this.extractAddresses(event);
      addresses.forEach((address) => {
        touchedAddresses.add(address);
        const existing = this.activityByAddress.get(address) ?? [];
        const merged = this.mergeActivityEntries([tx, ...existing]);
        this.activityByAddress.set(address, merged);
        this.trackedAddresses.add(address);
        this.notificationsService
          ?.notifyAddressActivity(address, tx)
          .catch((err) =>
            this.logger.debug(
              `Notification dispatch skipped for ${address}: ${err instanceof Error ? err.message : err}`,
            ),
          );
      });
    });

    this.logger.log(
      `Processed ${payload.length} Helius events${
        signature ? ` (signature: ${signature})` : ''
      }`,
    );

    if (touchedAddresses.size > 0) {
      await Promise.all(
        Array.from(touchedAddresses).map((address) =>
          this.refreshAddressSnapshot(address).catch((err) => {
            this.logger.debug(
              `Snapshot refresh skipped for ${address}: ${err.message}`,
            );
          }),
        ),
      );
    }
  }

  async registerAddress(address: string) {
    const normalized = this.normalizeAddress(address);
    if (!normalized) {
      throw new Error('Address is required');
    }
    this.trackedAddresses.add(normalized);
    await this.refreshAddressSnapshot(normalized).catch((err) => {
      this.logger.warn(
        `Failed to refresh snapshot for ${normalized}: ${err.message}`,
      );
    });
    return this.snapshotByAddress.get(normalized) ?? null;
  }

  getAccountSnapshot(address: string) {
    const normalized = this.normalizeAddress(address);
    if (!normalized) {
      return { snapshot: null, activity: [] };
    }
    if (!this.snapshotByAddress.has(normalized)) {
      this.refreshAddressSnapshot(normalized).catch((err) => {
        this.logger.debug(
          `Lazy snapshot fetch failed for ${normalized}: ${err.message}`,
        );
      });
    }
    return {
      snapshot: this.snapshotByAddress.get(normalized) ?? null,
      activity: this.getActivity(normalized),
    };
  }

  getActivity(address: string) {
    const normalized = this.normalizeAddress(address);
    if (!normalized) {
      return [];
    }
    return this.activityByAddress.get(normalized) ?? [];
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'refreshTrackedAddresses',
  })
  async refreshTrackedAddresses() {
    if (this.trackedAddresses.size === 0) {
      return;
    }

    await Promise.all(
      Array.from(this.trackedAddresses).map((address) =>
        this.refreshAddressSnapshot(address).catch((err) => {
          this.logger.warn(
            `Scheduled refresh failed for ${address}: ${err.message}`,
          );
        }),
      ),
    );
  }

  private async refreshAddressSnapshot(address: string) {
    const snapshot = await this.fetchHeliusBalance(address);
    this.snapshotByAddress.set(address, snapshot);
    const recentTx = await this.fetchRecentTransactions(address);
    if (recentTx.length > 0) {
      this.activityByAddress.set(address, this.mergeActivityEntries(recentTx));
    }
  }

  private async fetchHeliusBalance(
    address: string,
  ): Promise<HeliusAccountSnapshot> {
    const url = this.buildHeliusUrl(`/v0/addresses/${address}/balances`);
    const response = await this.fetchWithAuth(url, { method: 'GET' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Helius balances API error: ${response.status} ${errorText}`,
      );
    }

    const payload = await response.json();
    const nativeBalance = payload?.nativeBalance ?? {};
    const solBalance =
      typeof nativeBalance.solanaBalance === 'number'
        ? nativeBalance.solanaBalance
        : typeof nativeBalance.solBalance === 'number'
          ? nativeBalance.solBalance
          : typeof nativeBalance.balance === 'number'
            ? nativeBalance.balance
            : typeof nativeBalance.lamports === 'number'
              ? nativeBalance.lamports / LAMPORTS_PER_SOL
              : 0;

    const solUsdValue =
      typeof nativeBalance.valueUsd === 'number'
        ? nativeBalance.valueUsd
        : typeof nativeBalance.priceUsd === 'number'
          ? nativeBalance.priceUsd * solBalance
          : 0;

    const tokenSource =
      payload?.tokens ?? payload?.tokenAccounts ?? payload?.mintBalances ?? [];

    const tokens: HeliusTokenSnapshot[] = Array.isArray(tokenSource)
      ? tokenSource
          .map((token) => this.coerceTokenSnapshot(token))
          .filter((token): token is HeliusTokenSnapshot => Boolean(token))
      : [];

    const tokenUsdTotal = tokens.reduce(
      (sum, token) => sum + (token.usdValue ?? 0),
      0,
    );

    const usdValue =
      typeof payload?.totalValueUsd === 'number'
        ? payload.totalValueUsd
        : typeof payload?.totalUsdValue === 'number'
          ? payload.totalUsdValue
          : solUsdValue + tokenUsdTotal;

    return {
      address,
      balance: Number(solBalance.toFixed(6)),
      usdValue: Number(usdValue.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      tokens,
    };
  }

  private async fetchRecentTransactions(
    address: string,
  ): Promise<HeliusWebhookTransaction[]> {
    const url = this.buildHeliusUrl(`/v0/addresses/${address}/transactions`, {
      limit: 20,
    });
    const response = await this.fetchWithAuth(url, { method: 'GET' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Helius transactions API error: ${response.status} ${errorText}`,
      );
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.map((event) => ({
      signature: event?.signature ?? event?.transactionSignature ?? 'unknown',
      timestamp: event?.timestamp ?? event?.blockTime ?? Date.now() / 1000,
      type: event?.type ?? event?.transactionType ?? 'UNKNOWN',
      description: event?.description,
      fee: event?.fee,
      source: event?.source,
      ingestedAt: Date.now(),
      balanceChanges: event?.balanceChanges ?? event?.nativeTransfers,
      raw: event,
    }));
  }

  private coerceTokenSnapshot(entry: any): HeliusTokenSnapshot | null {
    const mint =
      entry?.mint ??
      entry?.tokenMint ??
      entry?.address ??
      entry?.id ??
      entry?.tokenAddress;
    if (!mint) {
      return null;
    }

    const decimals = entry?.decimals ?? entry?.tokenDecimals ?? 0;
    const balanceRaw =
      entry?.balance ??
      entry?.uiAmount ??
      entry?.amount ??
      entry?.tokenAmount ??
      0;
    const balance =
      typeof balanceRaw === 'string' ? Number(balanceRaw) : (balanceRaw ?? 0);

    const usdValue =
      typeof entry?.usdValue === 'number'
        ? entry.usdValue
        : typeof entry?.valueUsd === 'number'
          ? entry.valueUsd
          : typeof entry?.priceUsd === 'number'
            ? balance * entry.priceUsd
            : typeof entry?.tokenPrice === 'number'
              ? balance * entry.tokenPrice
              : 0;

    return {
      mint,
      symbol: entry?.symbol ?? entry?.tokenSymbol ?? entry?.ticker,
      name: entry?.name ?? entry?.tokenName,
      balance,
      usdValue,
      decimals,
    };
  }

  private mergeActivityEntries(
    entries: HeliusWebhookTransaction[],
  ): HeliusWebhookTransaction[] {
    const dedup = new Map<string, HeliusWebhookTransaction>();
    entries.forEach((entry) => {
      dedup.set(entry.signature, entry);
    });
    return Array.from(dedup.values()).slice(0, this.maxEventsPerAddress);
  }

  private buildHeliusUrl(
    path: string,
    query: Record<string, string | number> = {},
  ) {
    const url = new URL(path, `${this.heliusApiBase}/`);
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  private getHeliusApiKey(): string {
    const key =
      this.infraConfig.heliusApiKey?.trim() ??
      process.env.HELIUS_API_KEY?.trim();
    if (key && key.length > 0) {
      return key;
    }
    return '';
  }

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const apiKey = this.getHeliusApiKey();
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  private extractAddresses(event: any): string[] {
    const addresses = new Set<string>();
    const add = (value?: string) => {
      const normalized = this.normalizeAddress(value);
      if (normalized) {
        addresses.add(normalized);
      }
    };

    add(event?.account);
    add(event?.wallet);

    const accountData = event?.accountData;
    if (Array.isArray(accountData)) {
      accountData.forEach((entry) => add(entry?.account));
    }

    const balanceChanges = event?.balanceChanges ?? event?.nativeTransfers;
    if (Array.isArray(balanceChanges)) {
      balanceChanges.forEach((change) => {
        add(change?.userAccount ?? change?.fromUserAccount);
        add(change?.toUserAccount);
      });
    }

    const accounts = event?.accounts;
    if (Array.isArray(accounts)) {
      accounts.forEach((acc) => add(acc));
    }

    return Array.from(addresses.values()).filter(Boolean);
  }

  private normalizeAddress(address?: string) {
    if (!address || typeof address !== 'string') {
      return null;
    }
    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
