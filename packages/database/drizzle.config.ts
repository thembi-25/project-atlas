import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration. See docs/04-database/migrations.md.
 *
 * Schema is intentionally empty in Sprint 0 (Engineering Foundation) — no
 * domain tables exist yet. This proves the migration pipeline is wired
 * correctly (local -> CI -> Staging) without inventing any table ahead of
 * the sprint that actually owns it. See docs/13-roadmap/sprint-0.md and
 * docs/13-roadmap/sprint-1.md (which introduces the first real tables:
 * organizations, users, organization_memberships, roles, permissions).
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
