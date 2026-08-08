import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit-tier config — see docs/09-testing/unit-testing.md.
 * `**\/*.integration.test.ts` requires a live, migrated Postgres instance
 * and runs under `vitest.integration.config.ts` / `pnpm test:integration`
 * instead — see docs/09-testing/api-testing.md,
 * docs/09-testing/integration-testing.md.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', '**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
