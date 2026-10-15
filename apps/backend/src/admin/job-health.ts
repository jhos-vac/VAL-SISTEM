import type { JobRunStatus } from '../jobs/job-lease.service';

export type JobState = 'ok' | 'failed' | 'late' | 'never';

export interface JobHealth {
  name: string;
  everyMs: number;
  state: JobState;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
}

// Un job está atrasado si pasaron más de dos intervalos desde que terminó.
export function jobHealth(
  schedule: { name: string; everyMs: number }[],
  statuses: JobRunStatus[],
  now: Date,
): JobHealth[] {
  const byName = new Map(statuses.map((s) => [s.name, s]));
  return schedule.map(({ name, everyMs }) => {
    const s = byName.get(name);
    let state: JobState;
    if (!s?.lastFinishedAt) state = 'never';
    else if (s.lastOk === false) state = 'failed';
    else if (now.getTime() - s.lastFinishedAt.getTime() > 2 * everyMs)
      state = 'late';
    else state = 'ok';
    return {
      name,
      everyMs,
      state,
      lastStartedAt: s?.lastStartedAt ?? null,
      lastFinishedAt: s?.lastFinishedAt ?? null,
      lastDurationMs: s?.lastDurationMs ?? null,
      lastError: s?.lastError ?? null,
    };
  });
}
