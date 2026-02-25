import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

const makePrisma = () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

describe('UsersService', () => {
  it('creates user when missing for device', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1' });

    const service = new UsersService(prisma as any);
    const user = await service.findOrCreateByDeviceId('device-1');
    expect(user).toEqual({ id: 'user-1' });
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('updates last seen when device exists', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    const service = new UsersService(prisma as any);
    const user = await service.findOrCreateByDeviceId('device-1');
    expect(user).toEqual({ id: 'user-1' });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('throws when user missing in findByIdWithRelations', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as any);
    await expect(service.findByIdWithRelations('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
