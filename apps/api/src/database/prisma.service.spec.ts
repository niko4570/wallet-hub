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

  it('throws when DATABASE_URL is missing', () => {
    process.env.DATABASE_URL = '';
    expect(() => new PrismaService()).toThrow('DATABASE_URL');
  });

  it('connects and disconnects on lifecycle hooks', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect((service as any).$connect).toHaveBeenCalled();
    expect((service as any).$disconnect).toHaveBeenCalled();
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
    const keys = Reflect.ownKeys(service).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    );
    keys.forEach((key) => {
      (service as any)[key] = { deleteMany: jest.fn() };
    });
    await service.cleanDatabase();
    keys.forEach((key) => {
      expect((service as any)[key].deleteMany).toHaveBeenCalled();
    });
  });

  it('rejects cleanDatabase in production', async () => {
    process.env.NODE_ENV = 'production';
    const service = new PrismaService();
    await expect(service.cleanDatabase()).rejects.toThrow('production');
  });
});
