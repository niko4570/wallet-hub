import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Transaction, Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new transaction
   */
  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    try {
      const transaction = await this.prisma.transaction.create({ data });
      this.logger.debug(`Created transaction: ${transaction.signature}`);
      return transaction;
    } catch (error: any) {
      // Ignore duplicate signature errors (idempotent)
      if (error.code === 'P2002') {
        this.logger.debug(`Transaction ${data.signature} already exists`);
        const existingTransaction = await this.findBySignature(data.signature);
        if (!existingTransaction) {
          throw new Error('Transaction not found after duplicate error');
        }
        return existingTransaction;
      }
      this.logger.error('Failed to create transaction', error);
      throw error;
    }
  }

  /**
   * Batch create transactions (upsert)
   */
  async batchCreate(
    transactions: Prisma.TransactionCreateInput[],
  ): Promise<number> {
    try {
      let created = 0;

      // Process in batches of 100 to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);

        await this.prisma.$transaction(
          batch.map((txn) =>
            this.prisma.transaction.upsert({
              where: { signature: txn.signature },
              create: txn,
              update: {
                status: txn.status,
                metadata: txn.metadata,
              },
            }),
          ),
        );

        created += batch.length;
      }

      this.logger.log(`Batch created/updated ${created} transactions`);
      return created;
    } catch (error) {
      this.logger.error('Failed to batch create transactions', error);
      throw error;
    }
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    try {
      return await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          walletAccount: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find transaction ${id}`, error);
      throw error;
    }
  }

  /**
   * Find transaction by signature
   */
  async findBySignature(signature: string): Promise<Transaction | null> {
    try {
      return await this.prisma.transaction.findUnique({
        where: { signature },
        include: {
          walletAccount: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find transaction ${signature}`, error);
      throw error;
    }
  }

  /**
   * Find transactions for a wallet account
   */
  async findByWalletAccountId(
    walletAccountId: string,
    params?: {
      skip?: number;
      take?: number;
      type?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<Transaction[]> {
    try {
      const {
        skip = 0,
        take = 50,
        type,
        status,
        fromDate,
        toDate,
      } = params || {};

      return await this.prisma.transaction.findMany({
        where: {
          walletAccountId,
          ...(type && { type }),
          ...(status && { status }),
          ...(fromDate || toDate
            ? {
                timestamp: {
                  ...(fromDate && { gte: fromDate }),
                  ...(toDate && { lte: toDate }),
                },
              }
            : {}),
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: {
          walletAccount: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find transactions for wallet ${walletAccountId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find transactions for a user (across all wallets)
   */
  async findByUserId(
    userId: string,
    params?: {
      skip?: number;
      take?: number;
      type?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<Transaction[]> {
    try {
      const {
        skip = 0,
        take = 50,
        type,
        status,
        fromDate,
        toDate,
      } = params || {};

      return await this.prisma.transaction.findMany({
        where: {
          walletAccount: {
            userId,
          },
          ...(type && { type }),
          ...(status && { status }),
          ...(fromDate || toDate
            ? {
                timestamp: {
                  ...(fromDate && { gte: fromDate }),
                  ...(toDate && { lte: toDate }),
                },
              }
            : {}),
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: {
          walletAccount: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find transactions for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update transaction
   */
  async update(
    signature: string,
    data: Prisma.TransactionUpdateInput,
  ): Promise<Transaction> {
    try {
      const transaction = await this.prisma.transaction.update({
        where: { signature },
        data,
      });
      this.logger.log(`Updated transaction: ${signature}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to update transaction ${signature}`, error);
      throw error;
    }
  }

  /**
   * Delete transaction
   */
  async delete(signature: string): Promise<Transaction> {
    try {
      const transaction = await this.prisma.transaction.delete({
        where: { signature },
      });
      this.logger.log(`Deleted transaction: ${signature}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to delete transaction ${signature}`, error);
      throw error;
    }
  }

  /**
   * Get transaction statistics for a wallet
   */
  async getWalletStatistics(walletAccountId: string, days = 30) {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const transactions = await this.findByWalletAccountId(walletAccountId, {
        fromDate,
        take: 1000,
      });

      const stats = {
        total: transactions.length,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        totalVolumeUsd: 0,
        totalFeesUsd: 0,
      };

      transactions.forEach((txn) => {
        // Count by type
        stats.byType[txn.type] = (stats.byType[txn.type] || 0) + 1;

        // Count by status
        stats.byStatus[txn.status] = (stats.byStatus[txn.status] || 0) + 1;

        // Sum volumes and fees
        if (txn.amountUsd) {
          stats.totalVolumeUsd += Number(txn.amountUsd);
        }
        if (txn.feeUsd) {
          stats.totalFeesUsd += Number(txn.feeUsd);
        }
      });

      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get statistics for wallet ${walletAccountId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get recent transactions across all wallets for a user
   */
  async getRecentForUser(userId: string, limit = 20): Promise<Transaction[]> {
    try {
      return await this.findByUserId(userId, {
        take: limit,
        status: 'SUCCESS',
      });
    } catch (error) {
      this.logger.error(
        `Failed to get recent transactions for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clean old transactions (data retention)
   */
  async cleanOldTransactions(daysToKeep = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.transaction.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned ${result.count} old transactions`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean old transactions', error);
      throw error;
    }
  }

  /**
   * Get transaction count for wallet
   */
  async getCount(walletAccountId: string): Promise<number> {
    try {
      return await this.prisma.transaction.count({
        where: { walletAccountId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get transaction count for wallet ${walletAccountId}`,
        error,
      );
      throw error;
    }
  }
}
