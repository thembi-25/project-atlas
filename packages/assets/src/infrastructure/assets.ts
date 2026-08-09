import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Asset = typeof schema.assets.$inferSelect;
export type AssetStatus = Asset['status'];

export interface CreateAssetInput {
  organizationId: string;
  propertyId: string;
  buildingId?: string | undefined;
  roomId?: string | undefined;
  assetTypeId: string;
  manufacturerName?: string | undefined;
  modelNumber?: string | undefined;
  serialNumber?: string | undefined;
  installDate?: string | undefined;
}

export async function insertAsset(tx: DatabaseClient, input: CreateAssetInput): Promise<Asset> {
  const [asset] = await tx
    .insert(schema.assets)
    .values({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      buildingId: input.buildingId ?? null,
      roomId: input.roomId ?? null,
      assetTypeId: input.assetTypeId,
      manufacturerName: input.manufacturerName ?? null,
      modelNumber: input.modelNumber ?? null,
      serialNumber: input.serialNumber ?? null,
      installDate: input.installDate ?? null,
    })
    .returning();
  if (!asset) {
    throw new Error('Failed to insert asset');
  }
  return asset;
}

export async function findAssetById(
  tx: DatabaseClient,
  assetId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Asset | undefined> {
  const conditions = [eq(schema.assets.id, assetId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.assets.deletedAt));
  }
  const [asset] = await tx
    .select()
    .from(schema.assets)
    .where(and(...conditions))
    .limit(1);
  return asset;
}

export interface UpdateAssetFields {
  buildingId?: string | null | undefined;
  roomId?: string | null | undefined;
  assetTypeId?: string | undefined;
  manufacturerName?: string | null | undefined;
  modelNumber?: string | null | undefined;
  serialNumber?: string | null | undefined;
  installDate?: string | null | undefined;
}

/** Ordinary field updates only — never touches `status` (see `setAssetStatus`) or `deleted_at` (see `setAssetDeletedAt`). */
export async function updateAssetFields(
  tx: DatabaseClient,
  assetId: string,
  fields: UpdateAssetFields,
): Promise<Asset | undefined> {
  const [asset] = await tx
    .update(schema.assets)
    .set({
      ...(fields.buildingId !== undefined ? { buildingId: fields.buildingId } : {}),
      ...(fields.roomId !== undefined ? { roomId: fields.roomId } : {}),
      ...(fields.assetTypeId !== undefined ? { assetTypeId: fields.assetTypeId } : {}),
      ...(fields.manufacturerName !== undefined
        ? { manufacturerName: fields.manufacturerName }
        : {}),
      ...(fields.modelNumber !== undefined ? { modelNumber: fields.modelNumber } : {}),
      ...(fields.serialNumber !== undefined ? { serialNumber: fields.serialNumber } : {}),
      ...(fields.installDate !== undefined ? { installDate: fields.installDate } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.assets.id, assetId), isNull(schema.assets.deletedAt)))
    .returning();
  return asset;
}

/** assets.md business rules 2/3: a status transition, distinct from deletion — the row stays visible. */
export async function setAssetStatus(
  tx: DatabaseClient,
  assetId: string,
  status: AssetStatus,
): Promise<Asset | undefined> {
  const [asset] = await tx
    .update(schema.assets)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.assets.id, assetId), isNull(schema.assets.deletedAt)))
    .returning();
  return asset;
}

export async function setAssetDeletedAt(
  tx: DatabaseClient,
  assetId: string,
  deletedAt: Date | null,
): Promise<Asset | undefined> {
  const [asset] = await tx
    .update(schema.assets)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.assets.id, assetId))
    .returning();
  return asset;
}

export type AssetSortField = 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface AssetCursor {
  sortValue: string;
  id: string;
}

export interface ListAssetsParams {
  organizationId: string;
  propertyId?: string | undefined;
  limit: number;
  cursor?: AssetCursor | undefined;
  sortDirection: SortDirection;
  status?: AssetStatus | undefined;
}

export interface ListAssetsResult {
  rows: Asset[];
  hasMore: boolean;
}

function assetCursorCondition(direction: SortDirection, cursor: AssetCursor | undefined) {
  if (!cursor) return undefined;
  const op = direction === 'desc' ? sql`<` : sql`>`;
  return sql`(${schema.assets.createdAt}, ${schema.assets.id}) ${op} (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
}

/** Cursor-paginated, tenant-scoped Asset listing, optionally scoped to a Property — docs/05-api/pagination.md. */
export async function listAssetsForOrganization(
  tx: DatabaseClient,
  params: ListAssetsParams,
): Promise<ListAssetsResult> {
  const conditions = [
    eq(schema.assets.organizationId, params.organizationId),
    isNull(schema.assets.deletedAt),
  ];
  if (params.propertyId) {
    conditions.push(eq(schema.assets.propertyId, params.propertyId));
  }
  if (params.status) {
    conditions.push(eq(schema.assets.status, params.status));
  }
  const cursorCondition = assetCursorCondition(params.sortDirection, params.cursor);
  if (cursorCondition) {
    conditions.push(cursorCondition);
  }

  const orderExpr =
    params.sortDirection === 'desc'
      ? sql`${schema.assets.createdAt} DESC, ${schema.assets.id} DESC`
      : sql`${schema.assets.createdAt} ASC, ${schema.assets.id} ASC`;

  const rows = await tx
    .select()
    .from(schema.assets)
    .where(and(...conditions))
    .orderBy(orderExpr)
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}

export interface AssetSearchHit {
  asset: Asset;
  rank: number;
}

/** Raw snake_case row shape as returned by `tx.execute` (SQL column names), distinct from Drizzle's camelCase `$inferSelect`. */
type AssetRow = {
  id: string;
  organization_id: string;
  property_id: string;
  building_id: string | null;
  room_id: string | null;
  asset_type_id: string;
  manufacturer_name: string | null;
  model_number: string | null;
  serial_number: string | null;
  install_date: string | null;
  status: AssetStatus;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function assetFromRow(row: AssetRow): Asset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    propertyId: row.property_id,
    buildingId: row.building_id,
    roomId: row.room_id,
    assetTypeId: row.asset_type_id,
    manufacturerName: row.manufacturer_name,
    modelNumber: row.model_number,
    serialNumber: row.serial_number,
    installDate: row.install_date,
    status: row.status,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Full-text + trigram search over manufacturer/model/serial — docs/02-architecture/search-strategy.md. */
export async function searchAssets(
  tx: DatabaseClient,
  organizationId: string,
  query: string,
  limit: number,
): Promise<AssetSearchHit[]> {
  const rows = await tx.execute<AssetRow & { rank: number }>(sql`
    SELECT a.*,
      ts_rank(a.search_vector, websearch_to_tsquery('simple', ${query}))
        + GREATEST(
            similarity(coalesce(a.manufacturer_name, ''), ${query}),
            similarity(coalesce(a.model_number, ''), ${query}),
            similarity(coalesce(a.serial_number, ''), ${query})
          ) AS rank
    FROM properties.assets a
    WHERE a.organization_id = ${organizationId}::uuid
      AND a.deleted_at IS NULL
      AND (
        a.search_vector @@ websearch_to_tsquery('simple', ${query})
        OR a.manufacturer_name % ${query}
        OR a.model_number % ${query}
        OR a.serial_number % ${query}
      )
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    asset: assetFromRow(row),
    rank: Number(row.rank),
  }));
}
