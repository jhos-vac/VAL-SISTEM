import { JobsService } from './jobs.service';
import type { JobLeaseService } from './job-lease.service';
import type { BinanceTickerSyncService } from '../market/binance-ticker-sync.service';
import type { BinanceAccountSyncService } from '../exchange/binance-account-sync.service';
import type { PortfolioSnapshotService } from '../portfolio/portfolio-snapshot.service';

jest.mock('./job-lease.service', () => ({ JobLeaseService: class {} }));
jest.mock('../market/binance-ticker-sync.service', () => ({
  BinanceTickerSyncService: class {},
}));
jest.mock('../exchange/binance-account-sync.service', () => ({
  BinanceAccountSyncService: class {},
}));
jest.mock('../portfolio/portfolio-snapshot.service', () => ({
  PortfolioSnapshotService: class {},
}));

function setup(acquired: boolean) {
  const leases = {
    tryAcquire: jest.fn().mockResolvedValue(acquired),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const job = {
    name: 'test.job',
    everyMs: 60_000,
    runOnStart: false,
    run: jest.fn().mockResolvedValue({ ok: true }),
  };
  const service = new JobsService(
    leases as unknown as JobLeaseService,
    {} as BinanceTickerSyncService,
    {} as BinanceAccountSyncService,
    {} as PortfolioSnapshotService,
  );
  return { service, leases, job };
}

describe('JobsService.runOnce', () => {
  it('sin lease (otra instancia lo tiene) no corre el job', async () => {
    const { service, job } = setup(false);
    await expect(service.runOnce(job)).resolves.toBe('skipped');
    expect(job.run).not.toHaveBeenCalled();
  });

  it('con lease corre y lo conserva casi todo el intervalo', async () => {
    const { service, leases, job } = setup(true);
    await expect(service.runOnce(job)).resolves.toBe('ran');
    expect(leases.tryAcquire).toHaveBeenCalledWith('test.job', 54_000);
    expect(leases.release).not.toHaveBeenCalled();
  });

  it('si el job falla libera el lease para que se reintente', async () => {
    const { service, leases, job } = setup(true);
    job.run.mockRejectedValueOnce(new Error('boom'));
    await expect(service.runOnce(job)).resolves.toBe('failed');
    expect(leases.release).toHaveBeenCalledWith('test.job');
  });
});
