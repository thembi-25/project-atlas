import { defineConfig } from 'vitest/config';

/**
 * Integration-tier config — see docs/09-testing/integration-testing.md.
 * Requires `DATABASE_URL` pointed at a Postgres instance already migrated
 * to the current schema (packages/database/migrations/). Not run by the
 * default `pnpm test` / CI `test` job — see docs/13-roadmap/
 * SPRINT-5-COMPLETION-REPORT.md for why this suite could not be executed
 * in the environment that wrote it, and run separately via
 * `pnpm test:integration` once DATABASE_URL is reachable.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/integration/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
