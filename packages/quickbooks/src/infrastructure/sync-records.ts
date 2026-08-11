import { and, desc, eq, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type SyncRecord = typeof schema.syncRecords.$inferSelect;
export type SyncEntityType = 'invoice' | 'payment';

export interface UpsertSyncRecordInput {
  organizationId: string;
  provider: 'quickbooks';
  entityType: SyncEntityType;
  entityId: string;
  status: 'pending' | 'synced' | 'failed';
  externalId?: string | undefined;
  errorDetail?: string | undefined;
}

/** Insert-or-update by the `uq_sync_records_provider_entity` unique index (provider, entity_type, entity_id) — migration 0027. */
export async function upsertSyncRecord(tx: DatabaseClient, input: UpsertSyncRecordInput): Promise<SyncRecord> {
  const [row] = await tx
    .insert(schema.syncRecords)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      entityType: input.entityType,
      entityId: input.entityId,
      status: input.status,
      externalId: input.externalId ?? null,
      lastAttemptedAt: new Date(),
      errorDetail: input.errorDetail ?? null,
    })
    .onConflictDoUpdate({
      target: [schema.syncRecords.provider, schema.syncRecords.entityType, schema.syncRecords.entityId],
      set: {
        status: input.status,
        externalId: input.externalId ?? null,
        lastAttemptedAt: new Date(),
        errorDetail: input.errorDetail ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error('Failed to upsert sync record.');
  return row;
}

export async function findSyncRecordByEntity(
  tx: DatabaseClient,
  params: { provider: 'quickbooks'; entityType: SyncEntityType; entityId: string },
): Promise<SyncRecord | undefined> {
  const [row] = await tx
    .select()
    .from(schema.syncRecords)
    .where(
      and(
        eq(schema.syncRecords.provider, params.provider),
        eq(schema.syncRecords.entityType, params.entityType),
        eq(schema.syncRecords.entityId, params.entityId),
      ),
    )
    .limit(1);
  return row;
}

function cursorCondition(cursor: { sortValue: string; id: string } | undefined) {
  if (!cursor) return undefined;
  return sql`(${schema.syncRecords.createdAt}, ${schema.syncRecords.id}) < (${new Date(cursor.sortValue)}::timestamptz, ${cursor.id}::uuid)`;
}

export interface ListSyncRecordsResult {
  rows: SyncRecord[];
  hasMore: boolean;
}

export async function listSyncRecordsForOrganization(
  tx: DatabaseClient,
  params: {
    organizationId: string;
    provider: 'quickbooks';
    limit: number;
    cursor?: { sortValue: string; id: string } | undefined;
  },
): Promise<ListSyncRecordsResult> {
  const conditions = [
    eq(schema.syncRecords.organizationId, params.organizationId),
    eq(schema.syncRecords.provider, params.provider),
  ];
  const cursorCond = cursorCondition(params.cursor);
  if (cursorCond) conditions.push(cursorCond);

  const rows = await tx
    .select()
    .from(schema.syncRecords)
    .where(and(...conditions))
    .orderBy(desc(schema.syncRecords.createdAt), desc(schema.syncRecords.id))
    .limit(params.limit + 1);

  const hasMore = rows.length > params.limit;
  return { rows: hasMore ? rows.slice(0, params.limit) : rows, hasMore };
}
