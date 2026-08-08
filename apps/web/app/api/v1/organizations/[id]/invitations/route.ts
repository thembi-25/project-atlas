import { z } from 'zod';
import { inviteMember } from '@atlas/identity';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { consoleInvitationNotifier } from '@/lib/invitation-notifier';
import { assertMfaEnrolledForPrivilegedAction } from '@/lib/mfa';

/**
 * POST /api/v1/organizations/{id}/invitations — Identity PRD §11.
 * "All Membership-mutating endpoints restricted to Owner/Admin" — enforced
 * both here (via inviteMember's app-layer check) and by RLS on the
 * resulting insert — see docs/11-adr/ADR-022-defense-in-depth.md.
 */
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'dispatcher', 'technician', 'accountant', 'read_only']),
  job_title: z.string().max(200).optional(),
});

export const POST = withApiHandler<{ membership_id: string }, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    await assertMfaEnrolledForPrivilegedAction();
    const json = await request.json().catch(() => null);
    const parsed = inviteMemberSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid invitation payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const result = await inviteMember(
      getDb(),
      {
        organizationId: context.params.id,
        actorUserId: actor.id,
        invitedEmail: parsed.data.email,
        roleName: parsed.data.role,
        jobTitle: parsed.data.job_title,
      },
      consoleInvitationNotifier,
    );

    return { data: { membership_id: result.membershipId }, status: 201 };
  },
);
