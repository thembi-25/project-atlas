import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError, PropertyHasActiveRecordsError } from '../domain/errors';
import {
  findPropertyById,
  hasActiveChildrenForProperty,
  listPropertiesForOrganization,
  searchProperties as searchPropertiesInfra,
  setPropertyDeletedAt,
  updatePropertyFields,
  type Property,
  type PropertyCursor,
  type PropertySearchHit,
  type PropertySortField,
  type PropertyType,
  type SortDirection,
} from '../infrastructure/properties';
import { requirePropertiesPermission } from './authorize';

export interface GetPropertyParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

export async function getProperty(
  db: DatabaseClient,
  params: GetPropertyParams,
): Promise<Property> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    return property;
  });
}

export interface ListPropertiesParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: PropertyCursor | undefined;
  sortField: PropertySortField;
  sortDirection: SortDirection;
  propertyType?: PropertyType | undefined;
}

export async function listProperties(
  db: DatabaseClient,
  params: ListPropertiesParams,
): Promise<{ rows: Property[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    return listPropertiesForOrganization(tx, params);
  });
}

export interface SearchPropertiesParams {
  organizationId: string;
  actorUserId: string;
  query: string;
  limit: number;
}

export async function searchProperties(
  db: DatabaseClient,
  params: SearchPropertiesParams,
): Promise<PropertySearchHit[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    return searchPropertiesInfra(tx, params.organizationId, params.query, params.limit);
  });
}

export interface UpdatePropertyParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  fields: {
    propertyType?: PropertyType | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | null | undefined;
    addressCity?: string | null | undefined;
    addressRegion?: string | null | undefined;
    addressPostalCode?: string | null | undefined;
    addressCountry?: string | null | undefined;
    latitude?: string | null | undefined;
    longitude?: string | null | undefined;
    accessNotes?: string | null | undefined;
  };
}

export async function updateProperty(
  db: DatabaseClient,
  params: UpdatePropertyParams,
): Promise<Property> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });
    const existing = await findPropertyById(tx, params.propertyId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    const updated = await updatePropertyFields(tx, params.propertyId, params.fields);
    if (!updated) {
      throw new NotFoundError('Property');
    }
    return updated;
  });
}

export interface ArchivePropertyParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

/** properties.md business rule 4: blocked while any non-deleted Building or Asset references this Property. */
export async function archiveProperty(
  db: DatabaseClient,
  params: ArchivePropertyParams,
): Promise<Property> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'delete' });
    const existing = await findPropertyById(tx, params.propertyId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    if (await hasActiveChildrenForProperty(tx, params.propertyId)) {
      throw new PropertyHasActiveRecordsError();
    }
    const archived = await setPropertyDeletedAt(tx, params.propertyId, new Date());
    if (!archived) {
      throw new NotFoundError('Property');
    }
    return archived;
  });
}

export interface RestorePropertyParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

/** soft-deletion.md rule 4: restore is Admin/Owner only — enforced via `properties:delete`, granted only to those Roles. */
export async function restoreProperty(
  db: DatabaseClient,
  params: RestorePropertyParams,
): Promise<Property> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'delete' });
    const existing = await findPropertyById(tx, params.propertyId, { includeDeleted: true });
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    const restored = await setPropertyDeletedAt(tx, params.propertyId, null);
    if (!restored) {
      throw new NotFoundError('Property');
    }
    return restored;
  });
}
