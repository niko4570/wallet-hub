import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { InMemoryPrismaService } from './in-memory-prisma.service';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly useInMemory: boolean;
  private readonly memory = new InMemoryPrismaService();
  private client?: PrismaClient;

  get isInMemory() {
    return this.useInMemory;
  }

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    this.useInMemory = !databaseUrl;

    if (this.useInMemory) {
      this.logger.warn(
        'DATABASE_URL is not set. Falling back to in-memory store.',
      );
      return;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);

    this.client = new PrismaClient({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    if (process.env.NODE_ENV === 'development') {
      this.client.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.client.$on('error' as never, (e: any) => {
      this.logger.error(`Error: ${e.message}`);
    });

    this.client.$on('warn' as never, (e: any) => {
      this.logger.warn(`Warning: ${e.message}`);
    });
  }

  get user(): any {
    return this.useInMemory ? this.memory.user : this.client!.user;
  }

  get walletAccount(): any {
    return this.useInMemory
      ? this.memory.walletAccount
      : this.client!.walletAccount;
  }

  get transaction(): any {
    return this.useInMemory
      ? this.memory.transaction
      : this.client!.transaction;
  }

  get sessionKey(): any {
    return this.useInMemory
      ? this.memory.sessionKey
      : (this.client as any)?.sessionKey;
  }

  get sessionPolicy(): any {
    return this.useInMemory
      ? this.memory.sessionPolicy
      : (this.client as any)?.sessionPolicy;
  }

  async $transaction(actions: any[]) {
    if (this.useInMemory) {
      return this.memory.$transaction(actions);
    }
    return this.client!.$transaction(actions as any);
  }

  async onModuleInit() {
    if (this.useInMemory || !this.client) {
      this.logger.log('In-memory data store initialized');
      return;
    }
    try {
      await this.client.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error as Error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.useInMemory || !this.client) {
      return;
    }
    await this.client.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async enableShutdownHooks(app: any) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    if (this.useInMemory) {
      this.logger.warn('cleanDatabase is a no-op for in-memory mode');
      return;
    }

    const models = Reflect.ownKeys(this.client as any).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    );

    return Promise.all(
      models.map((modelKey) => (this.client as any)[modelKey].deleteMany()),
    );
  }
}
