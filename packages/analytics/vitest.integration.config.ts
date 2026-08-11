import { defineConfig } from 'vitest/config';

/**
 * Integration-tier config — see docs/09-testing/integration-testing.md.
 * Requires `DATABASE_URL` pointed at a Postgres instance already migrated
 * to the current schema (packages/database/migrations/), including the
 * four Sprint 7 materialized views (migration 0029) and the refresh log
 * (migration 0030). Not run by the default `pnpm test` / CI `test` job —
 * see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md for why this suite
 * could not be executed in the environment that wrote it, and run
 * separately via `pnpm test:integration` once DATABASE_URL is reachable.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/integration/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
