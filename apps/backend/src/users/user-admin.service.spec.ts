import { BadRequestException } from '@nestjs/common';
import { signupsByDay, UserAdminService } from './user-admin.service';
import type { UserPrismaService } from '../prisma/user-prisma.service';

jest.mock('../prisma/user-prisma.service', () => ({
  UserPrismaService: class {},
}));

const now = new Date('2026-10-15T12:00:00Z');

describe('signupsByDay', () => {
  it('devuelve 30 días seguidos, incluidos los días sin altas', () => {
    const days = signupsByDay(
      [now, now, new Date('2026-10-01T05:00:00Z')],
      now,
    );
    expect(days).toHaveLength(30);
    expect(days[29]).toEqual({ date: '2026-10-15', count: 2 });
    expect(days.find((d) => d.date === '2026-10-01')?.count).toBe(1);
    expect(days.find((d) => d.date === '2026-10-02')?.count).toBe(0);
  });
});

describe('UserAdminService.setStatus', () => {
  function setup() {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const row = {
      id: 'u-2',
      email: 'otro@example.com',
      deletedAt: null,
      roles: [],
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(row),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([row]),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = new UserAdminService(
      prisma as unknown as UserPrismaService,
    );
    return { service, tx };
  }

  it('no deja que un admin se suspenda a sí mismo', async () => {
    const { service } = setup();
    await expect(
      service.setStatus('u-1', 'u-1', 'Suspended'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('suspender cierra todas las sesiones del usuario', async () => {
    const { service, tx } = setup();
    await service.setStatus('u-1', 'u-2', 'Suspended');
    const [updateArgs] = tx.user.update.mock.calls[0] as [
      { data: { status: string } },
    ];
    expect(updateArgs.data.status).toBe('Suspended');
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-2', revokedAt: null } }),
    );
  });

  it('reactivar no toca las sesiones', async () => {
    const { service, tx } = setup();
    await service.setStatus('u-1', 'u-2', 'Active');
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
