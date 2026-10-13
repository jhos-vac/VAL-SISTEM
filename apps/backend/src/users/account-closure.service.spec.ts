import { ForbiddenException } from '@nestjs/common';
import { AccountClosureService } from './account-closure.service';
import type { UserPrismaService } from '../prisma/user-prisma.service';

jest.mock('../prisma/user-prisma.service', () => ({
  UserPrismaService: class {},
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn((plain: string) => Promise.resolve(plain === 'correcta')),
  hash: jest.fn(() => Promise.resolve('hash-aleatorio')),
}));

function setup(deletedAt: Date | null = null) {
  const op = (name: string) => jest.fn((args: unknown) => ({ name, args }));
  const prisma = {
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'u-1', passwordHash: 'h', deletedAt }),
      update: op('user.update'),
    },
    refreshToken: { updateMany: op('refreshToken.updateMany') },
    passwordResetToken: { deleteMany: op('passwordResetToken.deleteMany') },
    device: { deleteMany: op('device.deleteMany') },
    userSetting: { deleteMany: op('userSetting.deleteMany') },
    userRole: { deleteMany: op('userRole.deleteMany') },
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  };
  const service = new AccountClosureService(
    prisma as unknown as UserPrismaService,
  );
  return { service, prisma };
}

describe('AccountClosureService.close', () => {
  it('borra los datos personales y cierra todo en una sola transacción', async () => {
    const { service, prisma } = setup();
    await service.close('u-1', 'correcta');
    const ops = (
      prisma.$transaction.mock.calls[0] as unknown as [Array<{ name: string }>]
    )[0];
    expect(ops.map((o) => o.name)).toEqual([
      'user.update',
      'refreshToken.updateMany',
      'passwordResetToken.deleteMany',
      'device.deleteMany',
      'userSetting.deleteMany',
      'userRole.deleteMany',
    ]);
    const { data } = (
      prisma.user.update.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0];
    expect(data).toMatchObject({
      status: 'Deleted',
      email: 'deleted+u-1@deleted.invalid',
      username: 'deleted_u-1',
      passwordHash: 'hash-aleatorio',
    });
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  it('con contraseña incorrecta no toca nada', async () => {
    const { service, prisma } = setup();
    await expect(service.close('u-1', 'mal')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('una cuenta ya dada de baja no se vuelve a procesar', async () => {
    const { service, prisma } = setup(new Date());
    await service.close('u-1', 'correcta');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
