import { jobHealth } from './job-health';

const MIN = 60_000;
const now = new Date('2026-10-15T12:00:00Z');
const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * MIN);

describe('jobHealth', () => {
  const schedule = [
    { name: 'a', everyMs: 5 * MIN },
    { name: 'b', everyMs: 5 * MIN },
    { name: 'c', everyMs: 5 * MIN },
    { name: 'd', everyMs: 5 * MIN },
  ];
  const status = (name: string, finishedMinutesAgo: number, ok: boolean) => ({
    name,
    lockedUntil: now,
    lastStartedAt: at(finishedMinutesAgo + 1),
    lastFinishedAt: at(finishedMinutesAgo),
    lastOk: ok,
    lastError: ok ? null : 'boom',
    lastDurationMs: MIN,
  });

  it('clasifica cada job: ok, fallido, atrasado o sin correr', () => {
    const result = jobHealth(
      schedule,
      [status('a', 2, true), status('b', 2, false), status('c', 11, true)],
      now,
    );
    expect(result.map((j) => j.state)).toEqual([
      'ok',
      'failed',
      'late',
      'never',
    ]);
    expect(result[1].lastError).toBe('boom');
  });
});
