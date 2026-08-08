import { findOrganizationById } from '@atlas/identity';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { withRequestContext } from '@atlas/database';

/**
 * GET /api/v1/organizations/{id} — Organization PRD §11.
 *
 * Runs the lookup under the caller's own RLS-scoped request context (not
 * the service escape hatch), so a User with no Membership in this
 * Organization gets exactly the same "not found" result RLS would have
 * produced regardless of what this code path does — the database enforces
 * the boundary, the route just surfaces its result. See
 * docs/07-security/tenant-isolation.md.
 */
export const GET = withApiHandler<unknown, { params: { id: string } }>(
  async (_request, context) => {
    const actor = await getAuthenticatedUser();
    const organizationId = context.params.id;

    const organization = await withRequestContext(getDb(), actor.id, (tx) =>
      findOrganizationById(tx, organizationId),
    );
    if (!organization) {
      throw new AppError('not_found', 'Organization not found');
    }

    return {
      data: {
        id: organization.id,
        name: organization.name,
        legal_name: organization.legalName,
        business_email: organization.businessEmail,
        business_phone: organization.businessPhone,
        timezone: organization.timezone,
        locale: organization.locale,
        subscription_status: organization.subscriptionStatus,
        created_at: organization.createdAt.toISOString(),
        updated_at: organization.updatedAt.toISOString(),
      },
    };
  },
);
