import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({ data });
      this.logger.log(`Created user: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
        include: {
          wallets: true,
          sessions: true,
          pushTokens: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find user ${id}`, error);
      throw error;
    }
  }

  /**
   * Find user by device ID
   */
  async findByDeviceId(deviceId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { deviceId },
        include: {
          wallets: true,
          sessions: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find user by deviceId ${deviceId}`, error);
      throw error;
    }
  }

  /**
   * Find or create user by device ID
   */
  async findOrCreateByDeviceId(deviceId: string): Promise<User> {
    try {
      let user = await this.findByDeviceId(deviceId);

      if (!user) {
        user = await this.create({ deviceId } as any);
        this.logger.log(`Created new user for device: ${deviceId}`);
      } else {
        // Update last seen
        user = await this.updateLastSeen(user.id);
      }

      return user;
    } catch (error) {
      this.logger.error(
        `Failed to findOrCreate user for device ${deviceId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });
      this.logger.log(`Updated user: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to update user ${id}`, error);
      throw error;
    }
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen(id: string): Promise<User> {
    return this.update(id, { lastSeen: new Date() });
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.delete({
        where: { id },
      });
      this.logger.log(`Deleted user: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}`, error);
      throw error;
    }
  }

  /**
   * Get user with all relations
   */
  async findByIdWithRelations(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          wallets: {
            include: {
              transactions: {
                orderBy: { timestamp: 'desc' },
                take: 50,
              },
            },
          },
          sessions: {
            where: { isRevoked: false },
            orderBy: { createdAt: 'desc' },
          },
          pushTokens: {
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User ${id} not found`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to find user with relations ${id}`, error);
      throw error;
    }
  }

  /**
   * List all users with pagination
   */
  async list(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }) {
    try {
      const { skip, take, cursor, where, orderBy } = params;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          skip,
          take,
          cursor,
          where,
          orderBy,
          include: {
            wallets: true,
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        total,
        page: skip ? Math.floor(skip / (take || 10)) + 1 : 1,
        pageSize: take || 10,
      };
    } catch (error) {
      this.logger.error('Failed to list users', error);
      throw error;
    }
  }
}
