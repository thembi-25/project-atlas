import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration. See docs/04-database/migrations.md.
 *
 * Schema was intentionally empty in Sprint 0 (Engineering Foundation) — no
 * domain tables existed yet, proving the migration pipeline is wired
 * correctly (local -> CI -> Staging) without inventing any table ahead of
 * the sprint that actually owns it. Sprint 1 (Identity & Organizations)
 * introduces the first real tables — see docs/13-roadmap/sprint-1.md.
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres',
  },
  strict: true,
  verbose: true,
});
