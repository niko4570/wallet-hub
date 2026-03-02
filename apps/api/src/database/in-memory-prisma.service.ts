import { randomUUID } from 'crypto';

interface FindManyArgs<T> {
  where?: Partial<T> & Record<string, unknown>;
  skip?: number;
  take?: number;
  include?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export class InMemoryPrismaService {
  private readonly users = new Map<string, any>();
  private readonly wallets = new Map<string, any>();
  private readonly transactions = new Map<string, any>();
  private readonly sessionKeys = new Map<string, any>();
  private readonly sessionPolicies = new Map<string, any>();

  user = {
    create: async ({ data }: any) => {
      const id = data.id ?? randomUUID();
      const now = new Date();
      const entity = { id, createdAt: now, updatedAt: now, ...data };
      this.users.set(id, entity);
      return { ...entity };
    },
    findUnique: async ({ where, include }: any) => {
      const found = this.findByKey(this.users, where);
      if (!found) return null;
      return this.attachUserRelations(found, include);
    },
    findMany: async ({
      where,
      skip = 0,
      take,
      include,
    }: FindManyArgs<any> = {}) => {
      const items = this.filterCollection(this.users, where);
      const sliced = items.slice(skip, take ? skip + take : undefined);
      return sliced.map((item) => this.attachUserRelations(item, include));
    },
    update: async ({ where, data }: any) => {
      const existing = this.findByKey(this.users, where);
      if (!existing) throw new Error('User not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.users.set(updated.id, updated);
      return { ...updated };
    },
    delete: async ({ where }: any) => {
      const existing = this.findByKey(this.users, where);
      if (!existing) throw new Error('User not found');
      this.users.delete(existing.id);
      return { ...existing };
    },
    count: async ({ where }: any = {}) => {
      return this.filterCollection(this.users, where).length;
    },
  };

  walletAccount = {
    create: async ({ data, include }: any) => {
      const id = data.id ?? randomUUID();
      const now = new Date();
      const userId = data.user?.connect?.id ?? data.userId;
      const entity = {
        id,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        ...data,
        userId,
      };
      delete (entity as any).user;
      this.wallets.set(id, entity);
      return this.attachWalletRelations(entity, include);
    },
    findUnique: async ({ where, include }: any) => {
      const found = this.findByKey(this.wallets, where, ['address']);
      if (!found) return null;
      return this.attachWalletRelations(found, include);
    },
    findMany: async ({
      where,
      skip = 0,
      take,
      include,
      orderBy,
    }: FindManyArgs<any> = {}) => {
      const items = this.filterCollection(this.wallets, where);
      const sorted = this.sortCollection(items, orderBy);
      const sliced = sorted.slice(skip, take ? skip + take : undefined);
      return sliced.map((item) => this.attachWalletRelations(item, include));
    },
    update: async ({ where, data }: any) => {
      const existing = this.findByKey(this.wallets, where, ['address']);
      if (!existing) throw new Error('Wallet not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.wallets.set(updated.id, updated);
      return { ...updated };
    },
    delete: async ({ where }: any) => {
      const existing = this.findByKey(this.wallets, where, ['address']);
      if (!existing) throw new Error('Wallet not found');
      this.wallets.delete(existing.id);
      return { ...existing };
    },
  };

  transaction = {
    create: async ({ data }: any) => {
      const id = data.id ?? randomUUID();
      const entity = { id, ...data };
      this.transactions.set(id, entity);
      return { ...entity };
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = this.findTransaction(where);
      if (existing) {
        const merged = { ...existing, ...update };
        this.transactions.set(existing.id, merged);
        return { ...merged };
      }
      return this.transaction.create({
        data: { ...create, id: create.id ?? randomUUID() },
      });
    },
    findUnique: async ({ where, include }: any) => {
      const txn = this.findTransaction(where);
      if (!txn) return null;
      return this.attachTransactionRelations(txn, include);
    },
    findMany: async ({
      where,
      skip = 0,
      take,
      include,
      orderBy,
    }: FindManyArgs<any> = {}) => {
      let items = Array.from(this.transactions.values());
      if (where?.walletAccountId) {
        items = items.filter(
          (item) => item.walletAccountId === where.walletAccountId,
        );
      }
      if (where?.walletAccount?.userId) {
        const walletIds = Array.from(this.wallets.values())
          .filter((wallet) => wallet.userId === where.walletAccount.userId)
          .map((wallet) => wallet.id);
        items = items.filter((item) =>
          walletIds.includes(item.walletAccountId),
        );
      }
      if (where?.type) {
        items = items.filter((item) => item.type === where.type);
      }
      if (where?.status) {
        items = items.filter((item) => item.status === where.status);
      }
      const timestampFilter = where?.timestamp as any;
      if (timestampFilter?.gte) {
        items = items.filter(
          (item) => new Date(item.timestamp) >= new Date(timestampFilter.gte),
        );
      }
      if (timestampFilter?.lte) {
        items = items.filter(
          (item) => new Date(item.timestamp) <= new Date(timestampFilter.lte),
        );
      }
      const sorted = this.sortCollection(
        items,
        orderBy ?? { timestamp: 'desc' },
      );
      const sliced = sorted.slice(skip, take ? skip + take : undefined);
      return sliced.map((item) =>
        this.attachTransactionRelations(item, include),
      );
    },
    update: async ({ where, data }: any) => {
      const existing = this.findTransaction(where);
      if (!existing) throw new Error('Transaction not found');
      const updated = { ...existing, ...data };
      this.transactions.set(existing.id, updated);
      return { ...updated };
    },
    delete: async ({ where }: any) => {
      const existing = this.findTransaction(where);
      if (!existing) throw new Error('Transaction not found');
      this.transactions.delete(existing.id);
      return { ...existing };
    },
    deleteMany: async ({ where }: any = {}) => {
      const items = await this.transaction.findMany({ where });
      items.forEach((item) => this.transactions.delete(item.id));
      return { count: items.length };
    },
    count: async ({ where }: any = {}) => {
      return (await this.transaction.findMany({ where })).length;
    },
  };

  sessionKey = {
    create: async ({ data, include }: any) => {
      const id = data.id ?? randomUUID();
      const entity = { id, ...data };
      this.sessionKeys.set(id, entity);
      return this.attachSessionKeyRelations(entity, include);
    },
    findUnique: async ({ where, include }: any) => {
      const found = this.findByKey(this.sessionKeys, where);
      if (!found) return null;
      return this.attachSessionKeyRelations(found, include);
    },
    findMany: async ({ where, include }: any = {}) => {
      const items = this.filterCollection(this.sessionKeys, where);
      return items.map((item) => this.attachSessionKeyRelations(item, include));
    },
    update: async ({ where, data }: any) => {
      const existing = this.findByKey(this.sessionKeys, where);
      if (!existing) throw new Error('Session key not found');
      const updated = { ...existing, ...data };
      this.sessionKeys.set(updated.id, updated);
      return { ...updated };
    },
  };

  sessionPolicy = {
    findMany: async () => Array.from(this.sessionPolicies.values()),
    findFirst: async ({ where }: any) => {
      const { walletAddress } = where ?? {};
      if (!walletAddress) return null;
      return (
        Array.from(this.sessionPolicies.values()).find(
          (policy) => policy.walletAddress === walletAddress,
        ) ?? null
      );
    },
    create: async ({ data }: any) => {
      const id = data.id ?? randomUUID();
      const entity = { id, ...data };
      this.sessionPolicies.set(id, entity);
      return { ...entity };
    },
  };

  async $transaction<T>(actions: Array<Promise<T>>): Promise<T[]> {
    const results: T[] = [];
    for (const action of actions) {
      results.push(await action);
    }
    return results;
  }

  private findByKey<T extends { id?: string }>(
    store: Map<string, T>,
    where: Record<string, any>,
    altKeys: string[] = [],
  ): T | null {
    if (!where) return null;
    const keys = ['id', ...altKeys];
    for (const key of keys) {
      if (where[key]) {
        const value = where[key];
        const match = Array.from(store.values()).find(
          (item: any) => item[key] === value,
        );
        if (match) return match;
      }
    }
    return null;
  }

  private filterCollection<T>(
    store: Map<string, T>,
    where?: Record<string, any>,
  ): T[] {
    if (!where) return Array.from(store.values());
    return Array.from(store.values()).filter((item: any) => {
      return Object.entries(where).every(([key, value]) => {
        if (value === undefined || value === null) return true;
        if (typeof value === 'object' && !(value instanceof Date)) return true;
        return item[key] === value;
      });
    });
  }

  private sortCollection<T>(
    items: T[],
    orderBy?: Record<string, 'asc' | 'desc'>,
  ): T[] {
    if (!orderBy) return items;
    const [[field, direction]] = Object.entries(orderBy);
    return [...items].sort((a: any, b: any) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      const result = av > bv ? 1 : -1;
      return direction === 'desc' ? -result : result;
    });
  }

  private findTransaction(where: Record<string, any>): any | null {
    if (!where) return null;
    if (where.signature) {
      return (
        Array.from(this.transactions.values()).find(
          (t) => t.signature === where.signature,
        ) ?? null
      );
    }
    if (where.id) {
      return this.transactions.get(where.id) ?? null;
    }
    return null;
  }

  private attachUserRelations(user: any, include?: Record<string, unknown>) {
    if (!include) return { ...user };
    const clone = { ...user } as any;
    if (include.wallets) {
      clone.wallets = Array.from(this.wallets.values()).filter(
        (w) => w.userId === user.id,
      );
    }
    if (include.sessions) {
      clone.sessions = Array.from(this.sessionKeys.values()).filter(
        (s) => s.userId === user.id,
      );
    }
    if (include.pushTokens) {
      clone.pushTokens = [];
    }
    return clone;
  }

  private attachWalletRelations(
    wallet: any,
    include?: Record<string, unknown>,
  ) {
    if (!include) return { ...wallet };
    const clone = { ...wallet } as any;
    if (include.user) {
      clone.user = this.users.get(wallet.userId) ?? null;
    }
    if (include.transactions) {
      const options = include.transactions as any;
      const orderBy = options?.orderBy;
      const take = options?.take;
      const list = Array.from(this.transactions.values()).filter(
        (txn) => txn.walletAccountId === wallet.id,
      );
      clone.transactions = this.sortCollection(list, orderBy).slice(0, take);
    }
    return clone;
  }

  private attachTransactionRelations(
    txn: any,
    include?: Record<string, unknown>,
  ) {
    if (!include) return { ...txn };
    const clone = { ...txn } as any;
    if (include.walletAccount) {
      clone.walletAccount = this.wallets.get(txn.walletAccountId) ?? null;
    }
    return clone;
  }

  private attachSessionKeyRelations(
    key: any,
    include?: Record<string, unknown>,
  ) {
    if (!include) return { ...key };
    const clone = { ...key } as any;
    if (include.policy) {
      clone.policy = key.policyId
        ? (this.sessionPolicies.get(key.policyId) ?? null)
        : null;
    }
    return clone;
  }
}
