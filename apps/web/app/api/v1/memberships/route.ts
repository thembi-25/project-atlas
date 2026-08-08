import { listMembershipsForOrganization, listRoleNamesForMembership } from '@atlas/identity';
import { withRequestContext } from '@atlas/database';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';

/**
 * GET /api/v1/memberships?organization_id={id} — Identity PRD §11.
 * RLS (organization_memberships_select) restricts the result set to rows
 * the caller may see; a caller with no access to the given Organization
 * simply gets an empty list, not an error — consistent with
 * docs/05-api/authorization.md's "404, never 403" principle applied to a
 * collection endpoint.
 */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const memberships = await withRequestContext(getDb(), actor.id, async (tx) => {
    const rows = await listMembershipsForOrganization(tx, organizationId);
    return Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        user_id: m.userId,
        status: m.status,
        job_title: m.jobTitle,
        invited_email: m.invitedEmail,
        roles: await listRoleNamesForMembership(tx, m.id),
        created_at: m.createdAt.toISOString(),
        updated_at: m.updatedAt.toISOString(),
      })),
    );
  });

  return { data: memberships };
});
