import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type IntegrationConnection = typeof schema.integrationConnections.$inferSelect;

/**
 * `integration_connections.access_token`/`refresh_token` are stored as
 * plain `text` (migration 0027). integrations-prd.md §10 calls for
 * "encrypted at rest" — this sandbox has no KMS/secrets-manager
 * integration configured (see docs/07-security/secrets-management.md) to
 * do field-level encryption with, so this is a disclosed simplification,
 * not a bug — see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known
 * Limitations. A production deployment must add column-level encryption
 * (e.g. `pgsodium`/`pgcrypto`, or application-layer envelope encryption)
 * before storing real OAuth tokens here.
 */
export async function findConnection(
  tx: DatabaseClient,
  organizationId: string,
  provider: 'quickbooks',
): Promise<IntegrationConnection | undefined> {
  const [row] = await tx
    .select()
    .from(schema.integrationConnections)
    .where(
      and(
        eq(schema.integrationConnections.organizationId, organizationId),
        eq(schema.integrationConnections.provider, provider),
      ),
    )
    .limit(1);
  return row;
}

export interface UpsertConnectedInput {
  organizationId: string;
  provider: 'quickbooks';
  accessToken: string;
  refreshToken: string;
  realmId: string;
  connectedByUserId: string;
}

/**
 * No unique index exists on (organization_id, provider) — migration 0027
 * only indexes `organization_id` alone — so this reads-then-writes rather
 * than `onConflictDoUpdate`, matching the low-volume, admin-initiated
 * nature of a connect action (never a high-concurrency write path).
 */
export async function upsertConnected(tx: DatabaseClient, input: UpsertConnectedInput): Promise<IntegrationConnection> {
  const existing = await findConnection(tx, input.organizationId, input.provider);
  if (existing) {
    const [row] = await tx
      .update(schema.integrationConnections)
      .set({
        status: 'connected',
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        realmId: input.realmId,
        connectedByUserId: input.connectedByUserId,
        connectedAt: new Date(),
        disconnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationConnections.id, existing.id))
      .returning();
    if (!row) throw new Error('Failed to update integration connection.');
    return row;
  }

  const [row] = await tx
    .insert(schema.integrationConnections)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      status: 'connected',
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      realmId: input.realmId,
      connectedByUserId: input.connectedByUserId,
      connectedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error('Failed to create integration connection.');
  return row;
}

export async function markDisconnected(tx: DatabaseClient, id: string): Promise<IntegrationConnection> {
  const [row] = await tx
    .update(schema.integrationConnections)
    .set({
      status: 'disconnected',
      accessToken: null,
      refreshToken: null,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.integrationConnections.id, id))
    .returning();
  if (!row) throw new Error('Failed to disconnect integration connection.');
  return row;
}
