import { z } from 'zod';
import { archiveProperty, getProperty, updateProperty } from '@atlas/properties';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeProperty } from '@/lib/properties-serializers';

/** GET /api/v1/properties/{id} — properties-prd.md §11. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const organizationId = new URL(request.url).searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const property = await getProperty(getDb(), {
    organizationId,
    actorUserId: actor.id,
    propertyId: context.params.id,
  });
  return { data: serializeProperty(property) };
});

const PROPERTY_TYPES = [
  'residential_single_family',
  'residential_multi_unit',
  'commercial',
] as const;

const patchPropertySchema = z.object({
  organization_id: z.string().uuid(),
  property_type: z.enum(PROPERTY_TYPES).optional(),
  address_line1: z.string().min(1).max(200).optional(),
  address_line2: z.string().max(200).nullable().optional(),
  address_city: z.string().max(100).nullable().optional(),
  address_region: z.string().max(100).nullable().optional(),
  address_postal_code: z.string().max(20).nullable().optional(),
  address_country: z.string().max(100).nullable().optional(),
  latitude: z.string().max(20).nullable().optional(),
  longitude: z.string().max(20).nullable().optional(),
  access_notes: z.string().max(5000).nullable().optional(),
});

/** PATCH /api/v1/properties/{id} — properties-prd.md §11. Never touches `deleted_at` — see DELETE below. */
export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = patchPropertySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid property payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const property = await updateProperty(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
      fields: {
        propertyType: parsed.data.property_type,
        addressLine1: parsed.data.address_line1,
        addressLine2: parsed.data.address_line2,
        addressCity: parsed.data.address_city,
        addressRegion: parsed.data.address_region,
        addressPostalCode: parsed.data.address_postal_code,
        addressCountry: parsed.data.address_country,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accessNotes: parsed.data.access_notes,
      },
    });
    return { data: serializeProperty(property) };
  },
);

const deletePropertyQuerySchema = z.object({ organization_id: z.string().uuid() });

/**
 * DELETE /api/v1/properties/{id} — soft-delete (archive), never a hard
 * delete — docs/05-api/resource-conventions.md. properties.md business
 * rule 4: blocked (`409`) while any non-deleted Building or Asset
 * references this Property.
 */
export const DELETE = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const parsed = deletePropertyQuerySchema.safeParse({
      organization_id: new URL(request.url).searchParams.get('organization_id'),
    });
    if (!parsed.success) {
      throw new AppError('bad_request', 'organization_id query parameter is required.');
    }

    const property = await archiveProperty(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      propertyId: context.params.id,
    });
    return { data: serializeProperty(property) };
  },
);
