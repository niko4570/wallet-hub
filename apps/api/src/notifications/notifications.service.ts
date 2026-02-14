import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { RegisterNotificationDto } from './dto/register-notification.dto';
import type { HeliusWebhookTransaction } from '../helius/helius.service';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

interface NotificationSummary {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();
  private readonly tokensByAddress = new Map<string, Set<string>>();
  private readonly addressesByToken = new Map<string, Set<string>>();

  registerDevice(payload: RegisterNotificationDto) {
    const token = payload.token.trim();
    if (!Expo.isExpoPushToken(token)) {
      throw new BadRequestException('Invalid Expo push token');
    }

    const normalizedAddresses = (payload.addresses ?? [])
      .map((address) => this.normalizeAddress(address))
      .filter((address): address is string => Boolean(address));

    this.removeTokenAssociations(token);

    if (normalizedAddresses.length > 0) {
      const addressSet = new Set(normalizedAddresses);
      this.addressesByToken.set(token, addressSet);
      addressSet.forEach((address) => {
        const tokenSet = this.tokensByAddress.get(address) ?? new Set<string>();
        tokenSet.add(token);
        this.tokensByAddress.set(address, tokenSet);
      });
    } else {
      this.addressesByToken.delete(token);
    }

    this.logger.debug(
      `Registered push token ${token.slice(0, 12)}... for ${normalizedAddresses.length} address(es)`,
    );

    return { token, addresses: normalizedAddresses };
  }

  async notifyAddressActivity(
    address: string,
    tx: HeliusWebhookTransaction,
  ): Promise<void> {
    const normalized = this.normalizeAddress(address);
    if (!normalized) {
      return;
    }

    const tokens = this.tokensByAddress.get(normalized);
    if (!tokens || tokens.size === 0) {
      return;
    }

    const summary = this.buildSummary(normalized, tx);

    const messages: ExpoPushMessage[] = Array.from(tokens).map((token) => ({
      to: token,
      title: summary.title,
      body: summary.body,
      data: summary.data,
      sound: 'default',
      priority: 'high',
    }));

    await this.dispatch(messages, normalized);
  }

  private buildSummary(
    address: string,
    tx: HeliusWebhookTransaction,
  ): NotificationSummary {
    const change = (tx.balanceChanges ?? []).find((entry) =>
      [entry?.userAccount, entry?.toUserAccount, entry?.fromUserAccount].some(
        (candidate) => this.normalizeAddress(candidate) === address,
      ),
    );

    if (!change) {
      return {
        title: 'Watch wallet activity detected',
        body: `${address.slice(0, 4)}...${address.slice(-4)} triggered ${tx.type}`,
        data: {
          address,
          signature: tx.signature,
          type: tx.type,
        },
      };
    }

    const amountRaw = typeof change.amount === 'number' ? change.amount : 0;
    const decimals =
      typeof change.decimals === 'number'
        ? change.decimals
        : change.mint === SOL_MINT
          ? 9
          : 0;
    const divisor =
      decimals > 0
        ? 10 ** decimals
        : change.mint === SOL_MINT
          ? LAMPORTS_PER_SOL
          : 1;
    const normalizedAmount = divisor > 0 ? amountRaw / divisor : amountRaw || 0;
    const direction = normalizedAmount >= 0 ? 'receive' : 'send';
    const symbol =
      change.mint === SOL_MINT
        ? 'SOL'
        : change.mint
          ? change.mint.slice(0, 4).toUpperCase()
          : 'Token';

    const formattedAmount =
      Math.abs(normalizedAmount) >= 1
        ? Math.abs(normalizedAmount).toFixed(2)
        : Math.abs(normalizedAmount).toFixed(4);

    return {
      title: direction === 'receive' ? 'Funds received' : 'Funds sent',
      body: `${direction === 'receive' ? 'Received' : 'Sent'} ${formattedAmount} ${symbol}`,
      data: {
        address,
        signature: tx.signature,
        type: tx.type,
        direction,
        amount: Number(Math.abs(normalizedAmount).toFixed(8)),
        mint: change.mint,
      },
    };
  }

  private async dispatch(messages: ExpoPushMessage[], address: string) {
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            const failingToken = chunk[index]?.to;
            this.handleTicketError(
              typeof failingToken === 'string' ? failingToken : undefined,
              ticket,
            );
          }
        });
      } catch (error) {
        this.logger.error(
          `Failed to send push chunk for ${address}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private handleTicketError(token: string | undefined, ticket: ExpoPushTicket) {
    if (!token || ticket.status !== 'error') {
      return;
    }
    this.logger.warn(
      `Push token ${token.slice(0, 12)}... failed: ${ticket.message ?? 'unknown error'}`,
    );
    const detailError = ticket.details?.error;
    if (
      detailError === 'DeviceNotRegistered' ||
      detailError === 'InvalidCredentials'
    ) {
      this.removeTokenAssociations(token);
      this.addressesByToken.delete(token);
    }
  }

  private removeTokenAssociations(token: string) {
    const previousAddresses = this.addressesByToken.get(token);
    if (!previousAddresses) {
      return;
    }

    previousAddresses.forEach((address) => {
      const tokens = this.tokensByAddress.get(address);
      if (!tokens) {
        return;
      }
      tokens.delete(token);
      if (tokens.size === 0) {
        this.tokensByAddress.delete(address);
      }
    });
  }

  private normalizeAddress(address?: string | null): string | null {
    if (!address || typeof address !== 'string') {
      return null;
    }
    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
