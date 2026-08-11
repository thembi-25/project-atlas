import type { DatabaseClient } from '@atlas/database';
import { hasPermission } from '@atlas/identity';
import { ForbiddenError } from '../domain/errors';

/**
 * integrations-prd.md §12: "Admin/Owner only — connecting an accounting
 * integration ... is treated as a high-privilege action." Reuses the
 * existing `organization:manage_settings` Permission (matching the RLS
 * policy in migration 0028) rather than inventing an `integrations`
 * resource — see docs/13-roadmap/sprint-7.md, "Permission model."
 */
export async function requireIntegrationsAdminAccess(
  tx: DatabaseClient,
  params: { organizationId: string; actorUserId: string },
): Promise<void> {
  const allowed = await hasPermission(tx, {
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    resource: 'organization',
    action: 'manage_settings',
  });
  if (!allowed) {
    throw new ForbiddenError();
  }
}
