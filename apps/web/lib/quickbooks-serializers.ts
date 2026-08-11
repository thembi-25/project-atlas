import type { IntegrationConnection, SyncRecord } from '@atlas/quickbooks';

/**
 * `access_token`/`refresh_token` are deliberately never serialized —
 * these are secrets (see integrations-prd.md §10, secrets-management.md)
 * that must never leave the server, even to the Organization's own
 * Admin/Owner who is otherwise authorized to view this connection.
 */
export function serializeIntegrationConnection(connection: IntegrationConnection) {
  return {
    id: connection.id,
    organization_id: connection.organizationId,
    provider: connection.provider,
    status: connection.status,
    realm_id: connection.realmId,
    connected_by_user_id: connection.connectedByUserId,
    connected_at: connection.connectedAt ? connection.connectedAt.toISOString() : null,
    disconnected_at: connection.disconnectedAt ? connection.disconnectedAt.toISOString() : null,
    created_at: connection.createdAt.toISOString(),
    updated_at: connection.updatedAt.toISOString(),
  };
}

export function serializeSyncRecord(record: SyncRecord) {
  return {
    id: record.id,
    organization_id: record.organizationId,
    provider: record.provider,
    entity_type: record.entityType,
    entity_id: record.entityId,
    status: record.status,
    external_id: record.externalId,
    last_attempted_at: record.lastAttemptedAt ? record.lastAttemptedAt.toISOString() : null,
    error_detail: record.errorDetail,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}
