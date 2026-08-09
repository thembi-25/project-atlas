import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Property = typeof schema.properties.$inferSelect;
export type PropertyType = Property['propertyType'];

/** Raw snake_case row shape as returned by `tx.execute` (SQL column names), distinct from Drizzle's camelCase `$inferSelect`. */
type PropertyRow = {
  id: string;
  organization_id: string;
  property_type: PropertyType;
  address_line1: string;
  address_line2: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  latitude: string | null;
  longitude: string | null;
  access_notes: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function propertyFromRow(row: PropertyRow): Property {
  return {
    id: row.id,
    organizationId: row.organization_id,
    propertyType: row.property_type,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    addressCity: row.address_city,
    addressRegion: row.address_region,
    addressPostalCode: row.address_postal_code,
    addressCountry: row.address_country,
    latitude: row.latitude,
    longitude: row.longitude,
    accessNotes: row.access_notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePropertyInput {
  organizationId: string;
  propertyType: PropertyType;
  addressLine1: string;
  addressLine2?: string | undefined;
  addressCity?: string | undefined;
  addressRegion?: string | undefined;
  addressPostalCode?: string | undefined;
  addressCountry?: string | undefined;
  latitude?: string | undefined;
  longitude?: string | undefined;
  accessNotes?: string | undefined;
}

export async function insertProperty(
  tx: DatabaseClient,
  input: CreatePropertyInput,
): Promise<Property> {
  const [property] = await tx
    .insert(schema.properties)
    .values({
      organizationId: input.organizationId,
      propertyType: input.propertyType,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 ?? null,
      addressCity: input.addressCity ?? null,
      addressRegion: input.addressRegion ?? null,
      addressPostalCode: input.addressPostalCode ?? null,
      addressCountry: input.addressCountry ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accessNotes: input.accessNotes ?? null,
    })
    .returning();
  if (!property) {
    throw new Error('Failed to insert property');
  }
  return property;
}

export async function findPropertyById(
  tx: DatabaseClient,
  propertyId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Property | undefined> {
  const conditions = [eq(schema.properties.id, propertyId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.properties.deletedAt));
  }
  const [property] = await tx
    .select()
    .from(schema.properties)
    .where(and(...conditions))
    .limit(1);
  return property;
}

export interface UpdatePropertyFields {
  propertyType?: PropertyType | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | null | undefined;
  addressCity?: string | null | undefined;
  addressRegion?: string | null | undefined;
  addressPostalCode?: string | null | undefined;
  addressCountry?: string | null | undefined;
  latitude?: string | null | undefined;
  longitude?: string | null | undefined;
  accessNotes?: string | null | undefined;
}

export async function updatePropertyFields(
  tx: DatabaseClient,
  propertyId: string,
  fields: UpdatePropertyFields,
): Promise<Property | undefined> {
  const [property] = await tx
    .update(schema.properties)
    .set({
      ...(fields.propertyType !== undefined ? { propertyType: fields.propertyType } : {}),
      ...(fields.addressLine1 !== undefined ? { addressLine1: fields.addressLine1 } : {}),
      ...(fields.addressLine2 !== undefined ? { addressLine2: fields.addressLine2 } : {}),
      ...(fields.addressCity !== undefined ? { addressCity: fields.addressCity } : {}),
      ...(fields.addressRegion !== undefined ? { addressRegion: fields.addressRegion } : {}),
      ...(fields.addressPostalCode !== undefined
        ? { addressPostalCode: fields.addressPostalCode }
        : {}),
      ...(fields.addressCountry !== undefined ? { addressCountry: fields.addressCountry } : {}),
      ...(fields.latitude !== undefined ? { latitude: fields.latitude } : {}),
      ...(fields.longitude !== undefined ? { longitude: fields.longitude } : {}),
      ...(fields.accessNotes !== undefined ? { accessNotes: fields.accessNotes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.properties.id, propertyId), isNull(schema.properties.deletedAt)))
    .returning();
  return property;
}

/** Archive (`deletedAt` set) or restore (`deletedAt` cleared) — docs/04-database/soft-deletion.md. */
export async function setPropertyDeletedAt(
  tx: DatabaseClient,
  propertyId: string,
  deletedAt: Date | null,
): Promise<Property | undefined> {
  const [property] = await tx
    .update(schema.properties)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.properties.id, propertyId))
    .returning();
  return property;
}

/**
 * properties.md business rule 4: deletion is blocked while any non-deleted
 * Building or Asset references this Property. Rooms are not checked
 * directly — a Room can only exist under a non-deleted Building, so a
 * blocking Building already covers that case transitively; Jobs does not
 * exist yet this sprint (see docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md,
 * "Known Limitations").
 */
export async function hasActiveChildrenForProperty(
  tx: DatabaseClient,
  propertyId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.buildings b WHERE b.property_id = ${propertyId}::uuid AND b.deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM properties.assets a WHERE a.property_id = ${propertyId}::uuid AND a.deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}

export type PropertySortField = 'created_at' | 'address_line1';
export type SortDirection = 'asc' | 'desc';

export interface PropertyCursor {
  sortValue: string;
  id: string;
}

export interface ListPropertiesParams {
  organizationId: string;
  limit: number;
  cursor?: PropertyCursor | undefined;
  sortField: PropertySortField;
  sortDirection: SortDirection;
  propertyType?: PropertyType | undefined;
}

export interface ListPropertiesResult {
  rows: Property[];
  hasMore: boolean;
}

function propertyCursorCondition(
  sortField: PropertySortField,
  direction: SortDirection,
  cursor: PropertyCursor | undefined,
) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  if (sortField === 'created_at') {
    return sql`(${schema.properties.createdAt}, ${schema.properties.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(${schema.properties.addressLine1}, ${schema.properties.id}) ${op} (${cursor.sortValue}::text, ${cursor.id}::uuid)`;
}

/** Cursor-paginated, tenant-scoped Property listing — docs/05-api/pagination.md. */
export async function listPropertiesForOrganization(
  tx: DatabaseClient,
  params: ListPropertiesParams,
): Promise<ListPropertiesResult> {
  const conditions = [
    eq(schema.properties.organizationId, params.organizationId),
    isNull(schema.properties.deletedAt),
  ];
  if (params.propertyType) {
    conditions.push(eq(schema.properties.propertyType, params.propertyType));
  }
  const cursorCondition = propertyCursorCondition(
    params.sortField,
    params.sortDirection,
    params.cursor,
  );
  if (cursorCondition) {
    conditions.push(cursorCondition);
  }

  const sortColumn =
    params.sortField === 'created_at'
      ? schema.properties.createdAt
      : schema.properties.addressLine1;
  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${sortColumn} DESC, ${schema.properties.id} DESC`
      : sql`${sortColumn} ASC, ${schema.properties.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.properties)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

export interface DuplicatePropertyCandidate {
  property: Property;
  addressLine1Similarity: number;
  matchedOnExactPostalCode: boolean;
}

/** properties.md business rule 3 / domain/duplicate-detection.ts. */
export async function findPotentialDuplicateProperties(
  tx: DatabaseClient,
  organizationId: string,
  input: { addressLine1: string; addressPostalCode?: string | undefined },
): Promise<DuplicatePropertyCandidate[]> {
  const rows = await tx.execute<
    PropertyRow & {
      address_line1_similarity: number;
      matched_on_exact_postal_code: boolean;
    }
  >(sql`
    SELECT
      p.*,
      similarity(p.address_line1, ${input.addressLine1}) AS address_line1_similarity,
      (${input.addressPostalCode ?? null}::text IS NOT NULL
        AND p.address_postal_code = ${input.addressPostalCode ?? null}) AS matched_on_exact_postal_code
    FROM properties.properties p
    WHERE p.organization_id = ${organizationId}::uuid
      AND p.deleted_at IS NULL
      AND similarity(p.address_line1, ${input.addressLine1}) >= 0.2
    LIMIT 10
  `);

  return rows.map((row) => ({
    property: propertyFromRow(row),
    addressLine1Similarity: Number(row.address_line1_similarity),
    matchedOnExactPostalCode: row.matched_on_exact_postal_code,
  }));
}

export interface PropertySearchHit {
  property: Property;
  rank: number;
}

/** Full-text + trigram Property search — docs/02-architecture/search-strategy.md. */
export async function searchProperties(
  tx: DatabaseClient,
  organizationId: string,
  query: string,
  limit: number,
): Promise<PropertySearchHit[]> {
  const rows = await tx.execute<PropertyRow & { rank: number }>(sql`
    SELECT p.*,
      ts_rank(p.search_vector, websearch_to_tsquery('simple', ${query})) + similarity(p.address_line1, ${query}) AS rank
    FROM properties.properties p
    WHERE p.organization_id = ${organizationId}::uuid
      AND p.deleted_at IS NULL
      AND (
        p.search_vector @@ websearch_to_tsquery('simple', ${query})
        OR p.address_line1 % ${query}
      )
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    property: propertyFromRow(row),
    rank: Number(row.rank),
  }));
}
