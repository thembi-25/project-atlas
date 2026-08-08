import { z } from 'zod';
import {
  changeMembershipRole,
  findMembershipById,
  reinstateMembership,
  removeMembership,
  suspendMembership,
} from '@atlas/identity';
import { withRequestContext } from '@atlas/database';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { assertMfaEnrolledForPrivilegedAction } from '@/lib/mfa';

/**
 * PATCH /api/v1/memberships/{id} — Identity PRD §11. Accepts a `status`
 * transition (`suspended`, `active`, `removed`) and/or a `role` change in
 * the same request; both are applied (role first, then status) so a
 * single call can e.g. demote and suspend together.
 */
const patchMembershipSchema = z.object({
  status: z.enum(['active', 'suspended', 'removed']).optional(),
  role: z
    .enum(['owner', 'admin', 'dispatcher', 'technician', 'accountant', 'read_only'])
    .optional(),
});

export const PATCH = withApiHandler<{ id: string }, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    await assertMfaEnrolledForPrivilegedAction();
    const membershipId = context.params.id;

    const target = await withRequestContext(getDb(), actor.id, (tx) =>
      findMembershipById(tx, membershipId),
    );
    if (!target) {
      throw new AppError('not_found', 'Membership not found');
    }

    const json = await request.json().catch(() => null);
    const parsed = patchMembershipSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid membership update payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const common = {
      organizationId: target.organizationId,
      actorUserId: actor.id,
      targetMembershipId: target.id,
    };

    if (parsed.data.role) {
      await changeMembershipRole(getDb(), { ...common, newRoleName: parsed.data.role });
    }

    if (parsed.data.status === 'suspended') {
      await suspendMembership(getDb(), common);
    } else if (parsed.data.status === 'active') {
      await reinstateMembership(getDb(), common);
    } else if (parsed.data.status === 'removed') {
      await removeMembership(getDb(), common);
    }

    return { data: { id: target.id } };
  },
);
