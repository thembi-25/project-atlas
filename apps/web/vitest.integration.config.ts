import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * API-tier integration config — docs/09-testing/api-testing.md: "verified
 * against the actual route handlers, using the same ephemeral test
 * database as Integration Testing." Requires `DATABASE_URL` pointed at a
 * Postgres instance already migrated to the current schema. Not run by
 * the default `pnpm test` / CI `test` job — see
 * docs/13-roadmap/SPRINT-2-COMPLETION-REPORT.md for why this suite could
 * not be executed in the environment that wrote it.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 20000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
