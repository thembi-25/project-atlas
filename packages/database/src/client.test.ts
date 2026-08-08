import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from './client';

describe('createDatabaseClient', () => {
  // postgres-js connections are lazy — constructing the client must not
  // throw or attempt a network connection, since packages/database has no
  // live database available in every environment it's imported in (e.g.
  // this unit test suite). Real connectivity is verified separately by
  // `pnpm db:check` — see docs/13-roadmap/SPRINT-0-COMPLETION-REPORT.md.
  it('constructs a client without connecting', () => {
    const db = createDatabaseClient('postgresql://postgres:postgres@localhost:54322/postgres');
    expect(db).toBeDefined();
    expect(typeof db.select).toBe('function');
    expect(typeof db.transaction).toBe('function');
  });

  it('exposes the (currently empty) schema on the client', () => {
    const db = createDatabaseClient('postgresql://postgres:postgres@localhost:54322/postgres');
    expect(db).toHaveProperty('query');
  });
});
