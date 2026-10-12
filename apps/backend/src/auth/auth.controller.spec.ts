import type { Request, Response } from 'express';
import type { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

// AuthService (cliente generado de Prisma) y @nestjs/config son ESM, que Jest
// no carga; acá se pasan dobles por constructor.
jest.mock('./auth.service', () => ({ AuthService: class {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

const expiresAt = new Date('2026-11-01T00:00:00.000Z');
const session = {
  user: { id: 'u-1' },
  accessToken: 'access',
  refreshToken: 'refresh',
  refreshTokenExpiresAt: expiresAt,
};

function setup() {
  const authService = {
    login: jest.fn().mockResolvedValue(session),
    refresh: jest.fn().mockResolvedValue(session),
  };
  const config = { get: jest.fn().mockReturnValue('false') };
  const controller = new AuthController(
    authService as unknown as AuthService,
    config as unknown as ConfigService,
  );
  const res = { cookie: jest.fn() };
  return { controller, authService, res };
}

const req = (headers: Record<string, string> = {}, cookies = {}) =>
  ({ headers, cookies, ip: '127.0.0.1' }) as unknown as Request;

describe('AuthController — entrega del refresh token', () => {
  it('web: el refresh token va en cookie y nunca en el body', async () => {
    const { controller, res } = setup();
    const body = await controller.login(
      { email: 'a@b.c', password: 'x' },
      req(),
      res as unknown as Response,
    );
    expect(body).toEqual({ user: { id: 'u-1' }, accessToken: 'access' });
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('móvil: el refresh token va en el body y no se setea cookie', async () => {
    const { controller, res } = setup();
    const body = await controller.login(
      { email: 'a@b.c', password: 'x' },
      req({ 'x-client-type': 'mobile' }),
      res as unknown as Response,
    );
    expect(body).toEqual(session);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('móvil: refresh lee el token del body y devuelve el rotado', async () => {
    const { controller, authService, res } = setup();
    const body = await controller.refresh(
      { refreshToken: 'old' },
      req({ 'x-client-type': 'mobile' }),
      res as unknown as Response,
    );
    expect(authService.refresh).toHaveBeenCalledWith('old', expect.anything());
    expect(body).toEqual(session);
  });
});
