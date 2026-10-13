import { UnauthorizedException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import type { AccountClosureService } from '../users/account-closure.service';
import type { UserDataPurgeService } from '../portfolio/user-data-purge.service';

jest.mock('../users/account-closure.service', () => ({
  AccountClosureService: class {},
}));
jest.mock('../portfolio/user-data-purge.service', () => ({
  UserDataPurgeService: class {},
}));

function setup() {
  const calls: string[] = [];
  const closure = {
    close: jest.fn(() => {
      calls.push('close');
      return Promise.resolve();
    }),
    listRecentlyClosed: jest.fn().mockResolvedValue(['u-1', 'u-2']),
  };
  const purge = {
    purgeUser: jest.fn(() => {
      calls.push('purge');
      return Promise.resolve();
    }),
  };
  const service = new AccountDeletionService(
    closure as unknown as AccountClosureService,
    purge as unknown as UserDataPurgeService,
  );
  return { service, closure, purge, calls };
}

describe('AccountDeletionService', () => {
  it('primero da de baja la cuenta y después borra sus datos de Portfolio', async () => {
    const { service, calls } = setup();
    await service.deleteAccount('u-1', 'secreta');
    expect(calls).toEqual(['close', 'purge']);
  });

  it('con contraseña incorrecta no borra nada', async () => {
    const { service, closure, purge } = setup();
    closure.close.mockRejectedValueOnce(new UnauthorizedException());
    await expect(service.deleteAccount('u-1', 'mal')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(purge.purgeUser).not.toHaveBeenCalled();
  });

  it('si la limpieza de Portfolio falla, la baja igual queda hecha (la reintenta el job)', async () => {
    const { service, purge } = setup();
    purge.purgeUser.mockRejectedValueOnce(new Error('timeout'));
    await expect(
      service.deleteAccount('u-1', 'secreta'),
    ).resolves.toBeUndefined();
  });

  it('el job limpia cada cuenta dada de baja aunque una falle', async () => {
    const { service, purge } = setup();
    purge.purgeUser.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.purgeRecentlyClosed()).resolves.toEqual({
      purged: 1,
      failed: 1,
    });
    expect(purge.purgeUser).toHaveBeenCalledTimes(2);
  });
});
