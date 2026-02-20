import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletAccount, Prisma } from '@prisma/client';

@Injectable()
export class WalletAccountsService {
  private readonly logger = new Logger(WalletAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new wallet account
   */
  async create(data: Prisma.WalletAccountCreateInput): Promise<WalletAccount> {
    try {
      const wallet = await this.prisma.walletAccount.create({
        data,
        include: {
          user: true,
        },
      });
      this.logger.log(
        `Created wallet account: ${wallet.address} for user ${wallet.userId}`,
      );
      return wallet;
    } catch (error) {
      this.logger.error('Failed to create wallet account', error);
      throw error;
    }
  }

  /**
   * Find wallet by ID
   */
  async findById(id: string): Promise<WalletAccount | null> {
    try {
      return await this.prisma.walletAccount.findUnique({
        where: { id },
        include: {
          user: true,
          transactions: {
            orderBy: { timestamp: 'desc' },
            take: 20,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Find wallet by address
   */
  async findByAddress(address: string): Promise<WalletAccount | null> {
    try {
      return await this.prisma.walletAccount.findUnique({
        where: { address },
        include: {
          user: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find wallet by address ${address}`, error);
      throw error;
    }
  }

  /**
   * Find all wallets for a user
   */
  async findByUserId(
    userId: string,
    includeInactive = false,
  ): Promise<WalletAccount[]> {
    try {
      return await this.prisma.walletAccount.findMany({
        where: {
          userId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find wallets for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Update wallet account
   */
  async update(
    id: string,
    data: Prisma.WalletAccountUpdateInput,
  ): Promise<WalletAccount> {
    try {
      const wallet = await this.prisma.walletAccount.update({
        where: { id },
        data,
      });
      this.logger.log(`Updated wallet: ${id}`);
      return wallet;
    } catch (error) {
      this.logger.error(`Failed to update wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Update wallet balance
   */
  async updateBalance(
    id: string,
    balance: number,
    balanceUsd: number,
  ): Promise<WalletAccount> {
    try {
      return await this.update(id, {
        lastBalance: balance,
        lastBalanceUsd: balanceUsd,
        lastBalanceUpdate: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to update balance for wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Batch update wallet balances
   */
  async batchUpdateBalances(
    updates: Array<{ id: string; balance: number; balanceUsd: number }>,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        updates.map((update) =>
          this.prisma.walletAccount.update({
            where: { id: update.id },
            data: {
              lastBalance: update.balance,
              lastBalanceUsd: update.balanceUsd,
              lastBalanceUpdate: new Date(),
            },
          }),
        ),
      );
      this.logger.log(`Batch updated ${updates.length} wallet balances`);
    } catch (error) {
      this.logger.error('Failed to batch update wallet balances', error);
      throw error;
    }
  }

  /**
   * Deactivate wallet
   */
  async deactivate(id: string): Promise<WalletAccount> {
    try {
      const wallet = await this.update(id, { isActive: false });
      this.logger.log(`Deactivated wallet: ${id}`);
      return wallet;
    } catch (error) {
      this.logger.error(`Failed to deactivate wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Reactivate wallet
   */
  async reactivate(id: string): Promise<WalletAccount> {
    try {
      const wallet = await this.update(id, { isActive: true });
      this.logger.log(`Reactivated wallet: ${id}`);
      return wallet;
    } catch (error) {
      this.logger.error(`Failed to reactivate wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete wallet account
   */
  async delete(id: string): Promise<WalletAccount> {
    try {
      const wallet = await this.prisma.walletAccount.delete({
        where: { id },
      });
      this.logger.log(`Deleted wallet: ${id}`);
      return wallet;
    } catch (error) {
      this.logger.error(`Failed to delete wallet ${id}`, error);
      throw error;
    }
  }

  /**
   * Get wallet statistics
   */
  async getStatistics(userId: string) {
    try {
      const wallets = await this.findByUserId(userId, true);

      const totalBalance = wallets.reduce(
        (sum, wallet) => sum + (Number(wallet.lastBalanceUsd) || 0),
        0,
      );

      const activeCount = wallets.filter((w) => w.isActive).length;

      return {
        totalWallets: wallets.length,
        activeWallets: activeCount,
        inactiveWallets: wallets.length - activeCount,
        totalBalanceUsd: totalBalance,
        wallets: wallets.map((w) => ({
          id: w.id,
          address: w.address,
          label: w.label,
          isActive: w.isActive,
          balanceUsd: Number(w.lastBalanceUsd) || 0,
          lastUpdate: w.lastBalanceUpdate,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get wallet statistics for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Link a wallet to a user (or create if not exists)
   */
  async linkWallet(
    userId: string,
    address: string,
    label?: string,
  ): Promise<WalletAccount> {
    try {
      // Check if wallet already exists
      const existing = await this.findByAddress(address);

      if (existing) {
        // If wallet exists but belongs to another user, throw error
        if (existing.userId !== userId) {
          throw new Error(
            `Wallet ${address} is already linked to another user`,
          );
        }
        // If wallet exists and is deactivated, reactivate it
        if (!existing.isActive) {
          return await this.reactivate(existing.id);
        }
        return existing;
      }

      // Create new wallet
      return await this.create({
        address,
        label,
        user: {
          connect: { id: userId },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to link wallet ${address} to user ${userId}`,
        error,
      );
      throw error;
    }
  }
}
