import { sql } from 'drizzle-orm';
import { pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tradeTypes } from './reference';
import { users } from './identity';

/**
 * Organization domain: the tenant root, its Trade Type selections, and
 * Teams. See docs/03-domain/organization.md, docs/13-roadmap/sprint-1.md.
 *
 * `users` is imported from ./identity for the `team_members` foreign key —
 * see the circular-reference note in identity.ts.
 */
export const orgSchema = pgSchema('org');

export const subscriptionStatusEnum = orgSchema.enum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled',
]);

/**
 * The tenant boundary — see docs/04-database/multi-tenancy.md. Deactivation
 * is soft and reversible (Organization PRD business rules) via
 * `deactivated_at`; not in docs/04-database/soft-deletion.md's explicit
 * table list (documented gap — see SPRINT-1-COMPLETION-REPORT.md), but a
 * distinct column from that convention's `deleted_at` since "deactivation"
 * is the domain's own term for it, not deletion.
 */
export const organizations = orgSchema.table('organizations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  businessEmail: text('business_email'),
  businessPhone: text('business_phone'),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en-US'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trialing'),
  logoUrl: text('logo_url'),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Join of Organization <-> Trade Type (an Organization may offer more than one trade). */
export const organizationTradeTypes = orgSchema.table(
  'organization_trade_types',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    tradeTypeId: uuid('trade_type_id')
      .notNull()
      .references(() => tradeTypes.id),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.tradeTypeId] })],
);

/** A Team belongs to exactly one Organization — docs/03-domain/organization.md. */
export const teams = orgSchema.table(
  'teams',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_teams_organization_id_name').on(table.organizationId, table.name)],
);

/** Join of Team <-> User — a User can belong to more than one Team in the same Organization. */
export const teamMembers = orgSchema.table(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.userId] })],
);
