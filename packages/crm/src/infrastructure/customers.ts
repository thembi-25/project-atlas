import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Customer = typeof schema.customers.$inferSelect;

export interface CreateCustomerInput {
  organizationId: string;
  type: 'residential' | 'commercial';
  displayName: string;
  billingAddressLine1?: string | undefined;
  billingAddressLine2?: string | undefined;
  billingAddressCity?: string | undefined;
  billingAddressRegion?: string | undefined;
  billingAddressPostalCode?: string | undefined;
  billingAddressCountry?: string | undefined;
  tags?: readonly string[] | undefined;
  notes?: string | undefined;
  portalAccessEnabled?: boolean | undefined;
}

export async function insertCustomer(
  tx: DatabaseClient,
  input: CreateCustomerInput,
): Promise<Customer> {
  const [customer] = await tx
    .insert(schema.customers)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      displayName: input.displayName,
      billingAddressLine1: input.billingAddressLine1 ?? null,
      billingAddressLine2: input.billingAddressLine2 ?? null,
      billingAddressCity: input.billingAddressCity ?? null,
      billingAddressRegion: input.billingAddressRegion ?? null,
      billingAddressPostalCode: input.billingAddressPostalCode ?? null,
      billingAddressCountry: input.billingAddressCountry ?? null,
      tags: input.tags ? [...input.tags] : [],
      notes: input.notes ?? null,
      portalAccessEnabled: input.portalAccessEnabled ?? false,
    })
    .returning();
  if (!customer) {
    throw new Error('Failed to insert customer');
  }
  return customer;
}

export async function findCustomerById(
  tx: DatabaseClient,
  customerId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Customer | undefined> {
  const conditions = [eq(schema.customers.id, customerId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.customers.deletedAt));
  }
  const [customer] = await tx
    .select()
    .from(schema.customers)
    .where(and(...conditions))
    .limit(1);
  return customer;
}

export interface UpdateCustomerFields {
  type?: 'residential' | 'commercial' | undefined;
  displayName?: string | undefined;
  billingAddressLine1?: string | null | undefined;
  billingAddressLine2?: string | null | undefined;
  billingAddressCity?: string | null | undefined;
  billingAddressRegion?: string | null | undefined;
  billingAddressPostalCode?: string | null | undefined;
  billingAddressCountry?: string | null | undefined;
  tags?: readonly string[] | undefined;
  notes?: string | null | undefined;
  portalAccessEnabled?: boolean | undefined;
}

/**
 * Ordinary field updates only — never touches `deleted_at`. See
 * `setCustomerDeletedAt` for archive/restore, which is a distinct
 * use-case boundary gated by a distinct Permission (`customers:delete`,
 * not `customers:write`) — see docs/03-domain/permissions.md.
 */
export async function updateCustomerFields(
  tx: DatabaseClient,
  customerId: string,
  fields: UpdateCustomerFields,
): Promise<Customer | undefined> {
  const [customer] = await tx
    .update(schema.customers)
    .set({
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
      ...(fields.billingAddressLine1 !== undefined
        ? { billingAddressLine1: fields.billingAddressLine1 }
        : {}),
      ...(fields.billingAddressLine2 !== undefined
        ? { billingAddressLine2: fields.billingAddressLine2 }
        : {}),
      ...(fields.billingAddressCity !== undefined
        ? { billingAddressCity: fields.billingAddressCity }
        : {}),
      ...(fields.billingAddressRegion !== undefined
        ? { billingAddressRegion: fields.billingAddressRegion }
        : {}),
      ...(fields.billingAddressPostalCode !== undefined
        ? { billingAddressPostalCode: fields.billingAddressPostalCode }
        : {}),
      ...(fields.billingAddressCountry !== undefined
        ? { billingAddressCountry: fields.billingAddressCountry }
        : {}),
      ...(fields.tags !== undefined ? { tags: [...fields.tags] } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      ...(fields.portalAccessEnabled !== undefined
        ? { portalAccessEnabled: fields.portalAccessEnabled }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.customers.id, customerId), isNull(schema.customers.deletedAt)))
    .returning();
  return customer;
}

/** Archive (`deletedAt` set) or restore (`deletedAt` cleared) — docs/04-database/soft-deletion.md. */
export async function setCustomerDeletedAt(
  tx: DatabaseClient,
  customerId: string,
  deletedAt: Date | null,
): Promise<Customer | undefined> {
  const [customer] = await tx
    .update(schema.customers)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.customers.id, customerId))
    .returning();
  return customer;
}

export type CustomerSortField = 'created_at' | 'display_name';
export type SortDirection = 'asc' | 'desc';

export interface CustomerCursor {
  sortValue: string;
  id: string;
}

export interface ListCustomersParams {
  organizationId: string;
  limit: number;
  cursor?: CustomerCursor | undefined;
  sortField: CustomerSortField;
  sortDirection: SortDirection;
  type?: 'residential' | 'commercial' | undefined;
}

export interface ListCustomersResult {
  rows: Customer[];
  hasMore: boolean;
}

function customerCursorCondition(
  sortField: CustomerSortField,
  direction: SortDirection,
  cursor: CustomerCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.customers.createdAt}, ${schema.customers.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.customers.displayName}, ${schema.customers.id}) ${op} (${cursor.sortValue}::text, ${cursor.id}::uuid)`;
}

/** Cursor-paginated, tenant-scoped Customer listing — docs/05-api/pagination.md. */
export async function listCustomersForOrganization(
  tx: DatabaseClient,
  params: ListCustomersParams,
): Promise<ListCustomersResult> {
  const conditions = [
    eq(schema.customers.organizationId, params.organizationId),
    isNull(schema.customers.deletedAt),
  ];
  if (params.type) {
    conditions.push(eq(schema.customers.type, params.type));
  }
  const cursorCondition = customerCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) {
    conditions.push(cursorCondition);
  }

  const sortColumn =
    params.sortField === 'created_at' ? schema.customers.createdAt : schema.customers.displayName;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.customers.id} DESC`
      : sql`${sortColumn} ASC, ${schema.customers.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.customers)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

export interface DuplicateCandidate {
  customer: Customer;
  matchedOnExactPhone: boolean;
  matchedOnExactEmail: boolean;
  displayNameSimilarity: number;
}

/**
 * Candidate matches for customers-prd.md's "merge-duplicate-detection
 * prompt at creation" — see domain/duplicate-detection.ts for the
 * decision of which candidates are worth surfacing. Phone/email matches
 * are checked against the candidate Customer's Contacts (customers have
 * no phone/email of their own — docs/03-domain/customers.md business
 * rule 2).
 */
export async function findPotentialDuplicateCustomers(
  tx: DatabaseClient,
  organizationId: string,
  input: { displayName: string; phone?: string | undefined; email?: string | undefined },
): Promise<DuplicateCandidate[]> {
  const rows = await tx.execute<{
    id: string;
    organization_id: string;
    type: 'residential' | 'commercial';
    display_name: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_address_city: string | null;
    billing_address_region: string | null;
    billing_address_postal_code: string | null;
    billing_address_country: string | null;
    tags: string[];
    notes: string | null;
    portal_access_enabled: boolean;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
    matched_on_exact_phone: boolean;
    matched_on_exact_email: boolean;
    display_name_similarity: number;
  }>(sql`
    SELECT
      c.*,
      EXISTS (
        SELECT 1 FROM crm.contacts ct
        WHERE ct.customer_id = c.id AND ct.deleted_at IS NULL AND ct.phone = ${input.phone ?? null}
      ) AND ${input.phone ?? null}::text IS NOT NULL AS matched_on_exact_phone,
      EXISTS (
        SELECT 1 FROM crm.contacts ct
        WHERE ct.customer_id = c.id AND ct.deleted_at IS NULL AND ct.email = ${input.email ?? null}
      ) AND ${input.email ?? null}::text IS NOT NULL AS matched_on_exact_email,
      similarity(c.display_name, ${input.displayName}) AS display_name_similarity
    FROM crm.customers c
    WHERE c.organization_id = ${organizationId}::uuid
      AND c.deleted_at IS NULL
      AND (
        similarity(c.display_name, ${input.displayName}) >= 0.2
        OR EXISTS (
          SELECT 1 FROM crm.contacts ct
          WHERE ct.customer_id = c.id AND ct.deleted_at IS NULL
            AND ((${input.phone ?? null}::text IS NOT NULL AND ct.phone = ${input.phone ?? null})
              OR (${input.email ?? null}::text IS NOT NULL AND ct.email = ${input.email ?? null}))
        )
      )
    LIMIT 10
  `);

  return rows.map((row) => ({
    customer: {
      id: row.id,
      organizationId: row.organization_id,
      type: row.type,
      displayName: row.display_name,
      billingAddressLine1: row.billing_address_line1,
      billingAddressLine2: row.billing_address_line2,
      billingAddressCity: row.billing_address_city,
      billingAddressRegion: row.billing_address_region,
      billingAddressPostalCode: row.billing_address_postal_code,
      billingAddressCountry: row.billing_address_country,
      tags: row.tags,
      notes: row.notes,
      portalAccessEnabled: row.portal_access_enabled,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    matchedOnExactPhone: row.matched_on_exact_phone,
    matchedOnExactEmail: row.matched_on_exact_email,
    displayNameSimilarity: Number(row.display_name_similarity),
  }));
}

export interface CustomerSearchHit {
  customer: Customer;
  rank: number;
}

/** Full-text + trigram customer search — docs/02-architecture/search-strategy.md. */
export async function searchCustomers(
  tx: DatabaseClient,
  organizationId: string,
  query: string,
  limit: number,
): Promise<CustomerSearchHit[]> {
  const rows = await tx.execute<{
    id: string;
    organization_id: string;
    type: 'residential' | 'commercial';
    display_name: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_address_city: string | null;
    billing_address_region: string | null;
    billing_address_postal_code: string | null;
    billing_address_country: string | null;
    tags: string[];
    notes: string | null;
    portal_access_enabled: boolean;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
    rank: number;
  }>(sql`
    SELECT c.*,
      ts_rank(c.search_vector, websearch_to_tsquery('simple', ${query})) + similarity(c.display_name, ${query}) AS rank
    FROM crm.customers c
    WHERE c.organization_id = ${organizationId}::uuid
      AND c.deleted_at IS NULL
      AND (
        c.search_vector @@ websearch_to_tsquery('simple', ${query})
        OR c.display_name % ${query}
      )
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    customer: {
      id: row.id,
      organizationId: row.organization_id,
      type: row.type,
      displayName: row.display_name,
      billingAddressLine1: row.billing_address_line1,
      billingAddressLine2: row.billing_address_line2,
      billingAddressCity: row.billing_address_city,
      billingAddressRegion: row.billing_address_region,
      billingAddressPostalCode: row.billing_address_postal_code,
      billingAddressCountry: row.billing_address_country,
      tags: row.tags,
      notes: row.notes,
      portalAccessEnabled: row.portal_access_enabled,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    rank: Number(row.rank),
  }));
}
