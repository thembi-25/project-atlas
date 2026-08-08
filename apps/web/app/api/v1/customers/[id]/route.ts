import { z } from 'zod';
import { archiveCustomer, getCustomer, updateCustomer } from '@atlas/crm';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeCustomer } from '@/lib/crm-serializers';

/** GET /api/v1/customers/{id} — Customers PRD §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const customer = await getCustomer(getDb(), {
    organizationId,
    actorUserId: actor.id,
    customerId: context.params.id,
  });
  return { data: serializeCustomer(customer) };
});

const addressSchema = z.object({
  line1: z.string().max(200).nullable().optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
});

const patchCustomerSchema = z.object({
  organization_id: z.string().uuid(),
  type: z.enum(['residential', 'commercial']).optional(),
  display_name: z.string().min(1).max(200).optional(),
  billing_address: addressSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).nullable().optional(),
  portal_access_enabled: z.boolean().optional(),
});

/** PATCH /api/v1/customers/{id} — Customers PRD §11. Never touches `deleted_at` — see DELETE below. */
export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = patchCustomerSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid customer payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const customer = await updateCustomer(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      customerId: context.params.id,
      fields: {
        type: parsed.data.type,
        displayName: parsed.data.display_name,
        billingAddressLine1: parsed.data.billing_address?.line1,
        billingAddressLine2: parsed.data.billing_address?.line2,
        billingAddressCity: parsed.data.billing_address?.city,
        billingAddressRegion: parsed.data.billing_address?.region,
        billingAddressPostalCode: parsed.data.billing_address?.postal_code,
        billingAddressCountry: parsed.data.billing_address?.country,
        tags: parsed.data.tags,
        notes: parsed.data.notes,
        portalAccessEnabled: parsed.data.portal_access_enabled,
      },
    });
    return { data: serializeCustomer(customer) };
  },
);

const deleteCustomerQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/customers/{id} — soft-delete (archive), never a hard
 * delete — docs/05-api/resource-conventions.md. customers-prd.md §16's
 * block on Customers with active Jobs/Estimates/Invoices is not enforced
 * here — those modules don't exist yet this sprint, see
 * SPRINT-2-COMPLETION-REPORT.md, "Known Limitations."
 */
export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deleteCustomerQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const customer = await archiveCustomer(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      customerId: context.params.id,
    });
    return { data: serializeCustomer(customer) };
  },
);
