jest.mock('pg', () => ({
  Pool: jest.fn(() => ({})),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(() => ({})),
}));

jest.mock('@prisma/client', () => {
  class PrismaClient {
    public $on = jest.fn();
    public $connect = jest.fn();
    public $disconnect = jest.fn();
    constructor(_opts?: any) {}
  }
  return { PrismaClient };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DATABASE_URL: 'postgres://localhost/test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to in-memory when DATABASE_URL is missing', async () => {
    process.env.DATABASE_URL = '';
    const service = new PrismaService();
    await service.onModuleInit();
    expect(service.isInMemory).toBe(true);
  });

  it('connects and disconnects on lifecycle hooks', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect((service as any).client.$connect).toHaveBeenCalled();
    expect((service as any).client.$disconnect).toHaveBeenCalled();
  });

  it('registers shutdown hook', async () => {
    const service = new PrismaService();
    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    await service.enableShutdownHooks({ close: jest.fn() });
    expect(onSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    onSpy.mockRestore();
  });

  it('cleans database outside production', async () => {
    process.env.NODE_ENV = 'test';
    const service = new PrismaService();
    const keys = ['user', 'walletAccount'];
    (service as any).client = {
      user: { deleteMany: jest.fn() },
      walletAccount: { deleteMany: jest.fn() },
    };
    await service.cleanDatabase();
    keys.forEach((key) => {
      expect((service as any).client[key].deleteMany).toHaveBeenCalled();
    });
  });

  it('rejects cleanDatabase in production', async () => {
    process.env.NODE_ENV = 'production';
    const service = new PrismaService();
    await expect(service.cleanDatabase()).rejects.toThrow('production');
  });
});
