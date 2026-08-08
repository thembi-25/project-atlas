import { afterEach, describe, expect, it, vi } from 'vitest';
import { startWorker } from './index';

describe('startWorker', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a clear validation error before attempting to connect when required env vars are missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    await expect(startWorker()).rejects.toThrow(/DATABASE_URL|Environment validation failed/);
  });

  // NOTE: the success path (boss.start() against a live Postgres instance)
  // is not exercised here — this sandboxed execution environment has no
  // Docker daemon and no provisioned Supabase project. See
  // docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md, "Known Issues".
});
