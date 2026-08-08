import { sql } from 'drizzle-orm';
import { boolean, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Platform-wide reference data — not tenant-scoped, readable by every
 * authenticated Organization. See docs/04-database/multi-tenancy.md,
 * "Cross-tenant reference data."
 */
export const referenceSchema = pgSchema('reference');

export const tradeTypes = referenceSchema.table(
  'trade_types',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_trade_types_slug').on(table.slug)],
);
