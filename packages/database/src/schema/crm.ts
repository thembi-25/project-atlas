import { sql } from 'drizzle-orm';
import { boolean, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './org';

/**
 * CRM domain: Customers and Contacts — the operational customer record.
 * See docs/03-domain/customers.md, docs/03-domain/contacts.md,
 * docs/06-modules/crm-prd.md, docs/06-modules/customers-prd.md,
 * docs/13-roadmap/sprint-2.md.
 *
 * `search_vector` (generated tsvector, GIN + pg_trgm indexed) is not
 * modeled here — like Sprint 1's RLS/triggers, Drizzle Kit cannot express
 * `GENERATED ALWAYS AS (...) STORED` reliably alongside a hand-reviewed
 * migration workflow, and the application never reads or writes that
 * column directly (only Postgres's own `@@` operator does, via raw SQL in
 * the infrastructure layer). Its DDL lives in
 * migrations/0005_crm_customers_contacts_extensions.sql.
 */
export const crmSchema = pgSchema('crm');

export const customerTypeEnum = crmSchema.enum('customer_type', ['residential', 'commercial']);

/**
 * The billing party an Organization performs work for — see
 * docs/03-domain/customers.md. Deliberately has no `phone`/`email` columns
 * of its own: per that document's business rule 2, a Customer's primary
 * phone/email is always represented via an implicit primary Contact, not
 * duplicated onto the Customer row.
 *
 * `billing_address_*` is flat columns, not a separate `addresses` table or
 * jsonb blob — the shape is fixed and Sprint 2 has exactly one address
 * concept in scope (a service/mailing address belongs to Properties, a
 * later sprint) — see docs/04-database/naming-conventions.md on jsonb
 * ("never as a substitute for proper relational columns for known,
 * fixed-shape data") and docs/08-engineering, avoid unjustified
 * polymorphism.
 */
export const customers = crmSchema.table('customers', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  type: customerTypeEnum('type').notNull(),
  displayName: text('display_name').notNull(),
  billingAddressLine1: text('billing_address_line1'),
  billingAddressLine2: text('billing_address_line2'),
  billingAddressCity: text('billing_address_city'),
  billingAddressRegion: text('billing_address_region'),
  billingAddressPostalCode: text('billing_address_postal_code'),
  billingAddressCountry: text('billing_address_country'),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  notes: text('notes'),
  portalAccessEnabled: boolean('portal_access_enabled').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * An individual person tied to a Customer — see docs/03-domain/contacts.md.
 * Carries `organization_id` directly (denormalized from its parent
 * Customer, set once at creation and never changed) rather than being
 * scoped purely via `customer_id` join — matching how `jobs` carries both
 * `organization_id` and `customer_id`/`property_id` per
 * docs/04-database/schema-overview.md, not the lighter `org.team_members`
 * join-table pattern from Sprint 1: unlike `team_members`, Contacts are
 * independently audited (customers-prd.md S15) and queried, and
 * docs/04-database/indexes.md's own principle 2 expects a direct,
 * indexed `organization_id` on every such table so RLS/audit don't need
 * an extra join. The application layer always derives this value from the
 * looked-up parent Customer row, never from client input directly.
 *
 * `portal_user_id` (a link to a Customer Portal authentication identity)
 * is deliberately omitted: the Customer Portal PRD's identity model is a
 * separate, not-yet-built module, and docs/04-database/foreign-keys.md
 * requires every foreign key to be a real, enforced constraint — there is
 * no table yet to reference. `portal_access_enabled` (the flag) is
 * implemented; the portal identity link is deferred to that module.
 */
export const contacts = crmSchema.table(
  'contacts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    roleTitle: text('role_title'),
    isPrimary: boolean('is_primary').notNull().default(false),
    portalAccessEnabled: boolean('portal_access_enabled').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_contacts_customer_primary')
      .on(table.customerId)
      .where(sql`${table.isPrimary} = true AND ${table.deletedAt} IS NULL`),
  ],
);
