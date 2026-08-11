import { defineConfig } from 'vitest/config';

/**
 * Unit-tier config: pure domain logic only, no database — see
 * docs/09-testing/unit-testing.md. `src/integration/**` requires a live,
 * migrated Postgres instance and runs under `vitest.integration.config.ts`
 * / `pnpm test:integration` instead — see
 * docs/09-testing/integration-testing.md.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/integration/**'],
  },
});
