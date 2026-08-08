import { withServiceContext, type DatabaseClient } from '@atlas/database';
import { insertOrganization } from '../infrastructure/organizations';
import { insertActiveMembership, assignRoleToMembership } from '../infrastructure/memberships';
import { upsertUserFromAuth } from '../infrastructure/users';
import { findRoleByName } from '../infrastructure/roles';

export interface CreateOrganizationParams {
  name: string;
  legalName?: string | undefined;
  businessEmail?: string | undefined;
  businessPhone?: string | undefined;
  timezone?: string | undefined;
  locale?: string | undefined;
  tradeTypeIds: readonly string[];
  /** The signed-up Supabase Auth user who becomes this Organization's founding Owner. */
  owner: { id: string; email: string; fullName: string };
}

export interface CreateOrganizationResult {
  organizationId: string;
  membershipId: string;
}

/**
 * Creates an Organization and its founding Owner Membership atomically.
 * Uses the service-context escape hatch (bypasses RLS) because a
 * brand-new Organization cannot yet have a Membership row to check access
 * against — see packages/database/src/request-context.ts and
 * docs/07-security/tenant-isolation.md. This is the one Sprint 1 write
 * path that does not go through `withRequestContext`; every other
 * mutation in this package does.
 */
export async function createOrganization(
  db: DatabaseClient,
  params: CreateOrganizationParams,
): Promise<CreateOrganizationResult> {
  return withServiceContext(
    db,
    async (tx) => {
      const organization = await insertOrganization(tx, {
        name: params.name,
        legalName: params.legalName,
        businessEmail: params.businessEmail,
        businessPhone: params.businessPhone,
        timezone: params.timezone,
        locale: params.locale,
        tradeTypeIds: params.tradeTypeIds,
      });

      await upsertUserFromAuth(tx, params.owner);

      const membership = await insertActiveMembership(tx, {
        organizationId: organization.id,
        userId: params.owner.id,
      });

      const ownerRole = await findRoleByName(tx, 'owner');
      if (!ownerRole) {
        throw new Error("Seed data is missing the 'owner' Role — run the platform seed migration.");
      }
      await assignRoleToMembership(tx, membership.id, ownerRole.id);

      return { organizationId: organization.id, membershipId: membership.id };
    },
    params.owner.id,
  );
}
