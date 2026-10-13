import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { UserPrismaService } from '../prisma/user-prisma.service';
import type { EmailService } from '../common/email/email.service';

// Módulos ESM que Jest no carga; acá se pasan dobles por constructor.
jest.mock('../prisma/user-prisma.service', () => ({
  UserPrismaService: class {},
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../common/email/email.service', () => ({ EmailService: class {} }));
jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hash')),
  compare: jest.fn(() => Promise.resolve(true)),
}));

const dbUser = {
  id: 'u-1',
  firstName: 'Ana',
  lastName: 'Pérez',
  username: 'ana',
  email: 'ana@example.com',
  emailVerified: false,
  status: 'Active',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  deletedAt: null,
  passwordHash: 'old',
};

function setup() {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(dbUser),
      create: jest.fn().mockResolvedValue(dbUser),
      update: jest.fn((args: unknown) => ({ op: 'user.update', args })),
    },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'r-user' }) },
    userRole: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([{ role: { name: 'user' } }]),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // Transacción interactiva: el callback recibe el mismo doble.
  // Transacción en lote: se resuelven las operaciones en orden.
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: typeof prisma) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );

  const service = new AuthService(
    prisma as unknown as UserPrismaService,
    { signAsync: jest.fn().mockResolvedValue('jwt') } as unknown as JwtService,
    { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    {} as EmailService,
  );
  return { service, prisma };
}

const meta = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('AuthService.register', () => {
  const dto = {
    firstName: 'Ana',
    lastName: 'Pérez',
    username: 'ana',
    email: 'ana@example.com',
    password: 'secreta123',
  };

  it('crea el usuario y su rol en la misma transacción', async () => {
    const { service, prisma } = setup();
    await service.register(dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', roleId: 'r-user' },
    });
  });

  it('un registro simultáneo duplicado responde 409, no 500', async () => {
    const { service, prisma } = setup();
    prisma.user.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('AuthService.refresh', () => {
  const stored = {
    id: 't-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: dbUser,
  };

  it('revoca el token usado y emite uno nuevo', async () => {
    const { service, prisma } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(stored);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.refresh('raw', meta);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 't-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toBe('jwt');
  });

  it('si otro pedido ya lo usó (carrera), responde 401 sin emitir token', async () => {
    const { service, prisma } = setup();
    // Los dos pedidos leyeron el token sin revocar; este perdió la carrera.
    prisma.refreshToken.findUnique.mockResolvedValue(stored);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh('raw', meta)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.changePassword', () => {
  it('cambia la contraseña y revoca las sesiones en una sola transacción', async () => {
    const { service, prisma } = setup();
    prisma.refreshToken.updateMany.mockReturnValue({ op: 'revoke' });
    await service.changePassword('u-1', {
      currentPassword: 'old',
      newPassword: 'nueva12345',
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { op: 'user.update', args: expect.anything() as unknown },
      { op: 'revoke' },
    ]);
  });
});
