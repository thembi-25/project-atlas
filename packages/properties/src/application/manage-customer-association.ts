import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findCustomerForOrganization } from '@atlas/crm';
import { NotFoundError } from '../domain/errors';
import { findPropertyById } from '../infrastructure/properties';
import {
  endAssociation,
  findAssociationById,
  findCurrentAssociationForProperty,
  insertAssociation,
  listAssociationsForProperty,
  type PropertyCustomerAssociation,
} from '../infrastructure/property-customer-associations';
import { requirePropertiesPermission } from './authorize';

export interface AddCustomerAssociationParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  customerId: string;
}

/**
 * properties-prd.md §11: `POST /api/v1/properties/{id}/customer-associations`.
 * Ends the current association (if any) and starts a new one — the
 * Property record and its Building/Room/Asset history are untouched, per
 * properties.md business rule 1.
 */
export async function addCustomerAssociation(
  db: DatabaseClient,
  params: AddCustomerAssociationParams,
): Promise<PropertyCustomerAssociation> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });

    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    const customer = await findCustomerForOrganization(tx, {
      organizationId: params.organizationId,
      customerId: params.customerId,
    });
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    const current = await findCurrentAssociationForProperty(tx, params.propertyId);
    const now = new Date();
    if (current) {
      await endAssociation(tx, current.id, now);
    }

    return insertAssociation(tx, {
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      customerId: params.customerId,
      effectiveFrom: now,
    });
  });
}

export interface EndCustomerAssociationParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  associationId: string;
}

export async function endCustomerAssociation(
  db: DatabaseClient,
  params: EndCustomerAssociationParams,
): Promise<PropertyCustomerAssociation> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'write' });

    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    const association = await findAssociationById(tx, params.associationId);
    if (
      !association ||
      association.organizationId !== params.organizationId ||
      association.propertyId !== params.propertyId
    ) {
      throw new NotFoundError('PropertyCustomerAssociation');
    }
    const ended = await endAssociation(tx, params.associationId, new Date());
    if (!ended) {
      throw new NotFoundError('PropertyCustomerAssociation');
    }
    return ended;
  });
}

export interface ListCustomerAssociationsParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}

export async function listCustomerAssociations(
  db: DatabaseClient,
  params: ListCustomerAssociationsParams,
): Promise<PropertyCustomerAssociation[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, { ...params, action: 'read' });
    const property = await findPropertyById(tx, params.propertyId);
    if (!property || property.organizationId !== params.organizationId) {
      throw new NotFoundError('Property');
    }
    return listAssociationsForProperty(tx, params.propertyId);
  });
}
