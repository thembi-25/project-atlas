import { and, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export interface HasPermissionParams {
  organizationId: string;
  actorUserId: string;
  resource: string;
  action: string;
}

/**
 * Application-layer mirror of the `app.current_user_has_permission` SQL
 * helper (packages/database/migrations/0006_crm_rls_search_and_audit.sql)
 * — the same permission-catalog check, independently enforced at this
 * layer per docs/03-domain/permissions.md's two-layer model. Exposed from
 * @atlas/identity (not duplicated in each consuming module's own
 * infrastructure) because `organization_memberships`/`role_permissions`
 * are this module's tables — see
 * docs/02-architecture/component-architecture.md, "A module's database
 * tables are only ever queried directly by that module's own
 * infrastructure code."
 */
export async function hasPermission(
  tx: DatabaseClient,
  params: HasPermissionParams,
): Promise<boolean> {
  const rows = await tx
    .select({ id: schema.permissions.id })
    .from(schema.organizationMemberships)
    .innerJoin(
      schema.membershipRoles,
      eq(schema.membershipRoles.membershipId, schema.organizationMemberships.id),
    )
    .innerJoin(
      schema.rolePermissions,
      eq(schema.rolePermissions.roleId, schema.membershipRoles.roleId),
    )
    .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
    .where(
      and(
        eq(schema.organizationMemberships.userId, params.actorUserId),
        eq(schema.organizationMemberships.organizationId, params.organizationId),
        eq(schema.organizationMemberships.status, 'active'),
        eq(schema.permissions.resource, params.resource),
        eq(schema.permissions.action, params.action),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
