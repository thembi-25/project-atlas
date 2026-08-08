import { z } from 'zod';
import { createOrganization } from '@atlas/identity';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';

/**
 * POST /api/v1/organizations
 *
 * Organization creation flow — docs/13-roadmap/sprint-1.md deliverable 4.
 * Not explicitly enumerated in Organization PRD §11 (which lists only
 * GET/PATCH/DELETE for an existing Organization), but required by this
 * sprint's own deliverable list; implemented as the standard REST
 * "POST the collection to create" convention — see
 * docs/05-api/resource-conventions.md.
 */
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  legal_name: z.string().max(200).optional(),
  business_email: z.string().email().optional(),
  business_phone: z.string().max(50).optional(),
  timezone: z.string().max(100).optional(),
  locale: z.string().max(20).optional(),
  trade_type_ids: z.array(z.string().uuid()).default([]),
});

export const POST = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = createOrganizationSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid organization payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }

  const result = await createOrganization(getDb(), {
    name: parsed.data.name,
    legalName: parsed.data.legal_name,
    businessEmail: parsed.data.business_email,
    businessPhone: parsed.data.business_phone,
    timezone: parsed.data.timezone,
    locale: parsed.data.locale,
    tradeTypeIds: parsed.data.trade_type_ids,
    owner: actor,
  });

  return {
    data: { id: result.organizationId, membership_id: result.membershipId },
    status: 201,
  };
});
