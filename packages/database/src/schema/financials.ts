import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { organizations } from './org';
import { customers, contacts } from './crm';
import { jobs } from './jobs';
import { users } from './identity';

/**
 * Estimates, Invoicing & Payments domain — see docs/03-domain/estimates.md,
 * docs/03-domain/invoices.md, docs/03-domain/payments.md,
 * docs/06-modules/estimates-prd.md, docs/06-modules/invoicing-prd.md,
 * docs/06-modules/payments-prd.md, docs/11-adr/ADR-018-payments.md,
 * docs/13-roadmap/sprint-5.md. Maps to `@atlas/financials`, per
 * docs/04-database/schema-overview.md's single "`financials` schema"
 * grouping.
 *
 * Money columns are `numeric(12,2)` throughout, never `float`/`double
 * precision`, implicit-USD-only — docs/04-database/naming-conventions.md.
 * All totals (`subtotal`/`tax_total`/`total`/`line_total`) are computed by
 * the application layer from line items at write time and stored, never
 * accepted as independent client input — estimates.md business rule 1,
 * invoices.md.
 */
export const financialsSchema = pgSchema('financials');

export const estimateStatusEnum = financialsSchema.enum('estimate_status', [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
  'converted',
  'cancelled',
]);

export const invoiceStatusEnum = financialsSchema.enum('invoice_status', [
  'draft',
  'finalized',
  'sent',
  'partially_paid',
  'paid',
  'void',
]);

export const paymentMethodEnum = financialsSchema.enum('payment_method', [
  'card',
  'ach',
  'cash',
  'check',
  'other',
]);

export const paymentStatusEnum = financialsSchema.enum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
]);

/** payments.md Key attributes: "initiated_by (`customer_portal` for self-serve online payment)". */
export const paymentInitiatedByEnum = financialsSchema.enum('payment_initiated_by', [
  'staff',
  'customer_portal',
]);

/**
 * Server-authoritative, per-Organization sequential Estimate numbering —
 * same race-free atomic-UPSERT pattern as `jobs.job_number_counters`
 * (Sprint 4). Estimates have no gap-free requirement (unlike Invoices
 * below), so the number is allocated at creation time.
 */
export const estimateNumberCounters = financialsSchema.table('estimate_number_counters', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id),
  nextNumber: integer('next_number').notNull().default(1),
});

/**
 * Server-authoritative, per-Organization sequential Invoice numbering —
 * same atomic-UPSERT pattern, but invoices.md business rule 4 requires
 * numbering to be gap-free *for finalized Invoices specifically* ("a
 * voided draft does not consume a number visibly"). Unlike
 * `jobNumberCounters`/`estimateNumberCounters`, this counter is therefore
 * incremented at *finalize* time, not at Invoice creation — see
 * `invoices.invoiceNumber` below, which is nullable for that reason.
 */
export const invoiceNumberCounters = financialsSchema.table('invoice_number_counters', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id),
  nextNumber: integer('next_number').notNull().default(1),
});

/**
 * A priced proposal for work — docs/03-domain/estimates.md. `customerId`
 * is denormalized from the parent Job (matching `jobs.jobs`' own
 * denormalization of `customerId`/`propertyId`), needed directly here for
 * the Customer Portal's Contact-scoped RLS policy (a Contact's access is
 * keyed off `customerId`, not Organization membership — see
 * docs/06-modules/customer-portal-prd.md).
 *
 * `supersedesEstimateId` implements business rule 2: once `sent`, line
 * items are immutable, so an edit creates a new linked Estimate version
 * rather than mutating in place. Self-referencing FK — see Drizzle's
 * documented `AnyPgColumn` pattern for same-table references.
 */
export const estimates = financialsSchema.table(
  'estimates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    estimateNumber: integer('estimate_number').notNull(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    status: estimateStatusEnum('status').notNull().default('draft'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByContactId: uuid('approved_by_contact_id').references(() => contacts.id),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    cancellationReason: text('cancellation_reason'),
    supersedesEstimateId: uuid('supersedes_estimate_id').references(
      (): AnyPgColumn => estimates.id,
    ),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_estimates_organization_id_estimate_number').on(
      table.organizationId,
      table.estimateNumber,
    ),
    check(
      'chk_estimates_approver_single_source',
      sql`NOT (${table.approvedByContactId} IS NOT NULL AND ${table.approvedByUserId} IS NOT NULL)`,
    ),
  ],
);

/**
 * `inventoryItemId` (estimates.md: "optional, if the line corresponds to a
 * stocked part") is deliberately omitted — `inventory` is a Sprint 6
 * module that does not exist yet, and docs/04-database/foreign-keys.md
 * requires every foreign key to be a real, enforced constraint. Same
 * deferral precedent as `crm.contacts.portal_user_id` in Sprint 2-4.
 */
export const estimateLineItems = financialsSchema.table('estimate_line_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  estimateId: uuid('estimate_id')
    .notNull()
    .references(() => estimates.id),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A finalized bill — docs/03-domain/invoices.md. No `deletedAt`: Invoices
 * are never soft-deleted, only voided (business rule 1;
 * docs/04-database/soft-deletion.md). `invoiceNumber` is nullable and only
 * assigned at finalize time — see `invoiceNumberCounters` above.
 * `isDeposit` implements business rule 3's "distinct, explicitly
 * deposit-flagged Invoice type" (the one documented exception allowing
 * finalization before the parent Job is `completed`).
 */
export const invoices = financialsSchema.table(
  'invoices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    invoiceNumber: integer('invoice_number'),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    estimateId: uuid('estimate_id').references(() => estimates.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    isDeposit: boolean('is_deposit').notNull().default(false),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_invoices_organization_id_invoice_number').on(
      table.organizationId,
      table.invoiceNumber,
    ),
  ],
);

/** Structurally identical to `estimate_line_items` — invoices.md, "Relationships". `inventoryItemId` deferred for the same Sprint 6 reason. */
export const invoiceLineItems = financialsSchema.table('invoice_line_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A signed-negative adjustment to a finalized Invoice — invoices.md
 * business rule 1. Modeled as a single `amount` (always negative or, for
 * a documented correction of an under-billed amount, positive) plus
 * `reason`, not a separate line-item table: invoices.md's Data
 * requirements line mentions "line items" only in passing, and a Credit
 * Note's purpose here is a net financial adjustment record, not a second
 * billable line-item breakdown — a deliberate, minimal-but-correct scope
 * decision, documented in SPRINT-5-COMPLETION-REPORT.md.
 */
export const creditNotes = financialsSchema.table('credit_notes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`public.uuid_generate_v7()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  reason: text('reason').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  issuedByUserId: uuid('issued_by_user_id').references(() => users.id),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * An append-only recorded fund transfer — docs/03-domain/payments.md. No
 * `deletedAt`, and no generic `updatedAt`: "no `updated_at` beyond `status`
 * transition timestamps, since Payments are append-only" (Data
 * requirements) — `completedAt`/`failedAt`/`refundedAt` are those
 * transition timestamps. Refunds are new rows (`refundOfPaymentId`,
 * negative `amount`), never mutations of the original (business rule 3).
 * The cross-row invariant "sum of non-failed Payments can never exceed the
 * Invoice total" (business rule 4) cannot be expressed as a single-row
 * Postgres CHECK constraint; it is enforced by the application layer and a
 * database trigger added in the accompanying raw SQL migration — see
 * `packages/jobs`'s `schedule_events`-overlap precedent for the same
 * "logic Drizzle Kit cannot express as a table-level constraint" pattern.
 */
export const payments = financialsSchema.table(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`public.uuid_generate_v7()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    processor: text('processor'),
    processorReferenceId: text('processor_reference_id'),
    cardLast4: text('card_last4'),
    cardBrand: text('card_brand'),
    initiatedBy: paymentInitiatedByEnum('initiated_by').notNull().default('staff'),
    capturedByUserId: uuid('captured_by_user_id').references(() => users.id),
    refundOfPaymentId: uuid('refund_of_payment_id').references((): AnyPgColumn => payments.id),
    idempotencyKey: text('idempotency_key').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_payments_idempotency_key').on(table.idempotencyKey),
    check('chk_payments_amount_not_zero', sql`${table.amount} <> 0`),
    index('idx_payments_organization_id_invoice_id').on(table.organizationId, table.invoiceId),
  ],
);
