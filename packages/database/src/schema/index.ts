/**
 * Drizzle schema root.
 *
 * Schema is organized by Postgres schema per
 * docs/04-database/database-architecture.md. Sprint 1 (Identity &
 * Organizations) introduced reference, identity, org, platform. Sprint 2
 * (CRM & Customers) adds crm. Do not add a table here without a
 * corresponding entry in docs/03-domain/ and
 * docs/04-database/schema-overview.md — see
 * docs/12-claude/database-instructions.md.
 */
export * from './reference';
export * from './identity';
export * from './org';
export * from './platform';
export * from './crm';
