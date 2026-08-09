import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { findCustomerForOrganization } from '@atlas/crm';
import { shouldProvisionDefaultBuilding, DEFAULT_BUILDING_NAME } from '../domain/default-building';
import { isPotentialDuplicateAddress } from '../domain/duplicate-detection';
import { NotFoundError, PossibleDuplicatePropertyError } from '../domain/errors';
import {
  findPotentialDuplicateProperties,
  insertProperty,
  type Property,
  type PropertyType,
} from '../infrastructure/properties';
import { insertBuilding, type Building } from '../infrastructure/buildings';
import {
  insertAssociation,
  type PropertyCustomerAssociation,
} from '../infrastructure/property-customer-associations';
import { requirePropertiesPermission } from './authorize';

export interface CreatePropertyParams {
  organizationId: string;
  actorUserId: string;
  propertyType: PropertyType;
  addressLine1: string;
  addressLine2?: string | undefined;
  addressCity?: string | undefined;
  addressRegion?: string | undefined;
  addressPostalCode?: string | undefined;
  addressCountry?: string | undefined;
  latitude?: string | undefined;
  longitude?: string | undefined;
  accessNotes?: string | undefined;
  /** properties-prd.md §16: bypasses the duplicate-address block for a caller who has already seen and confirmed the prompt. */
  acknowledgeDuplicate?: boolean | undefined;
  /**
   * Optional initial Customer relationship — properties.md: a Property
   * may exist with no Customer association at all (e.g., bulk-imported),
   * so this is optional, not required.
   */
  customerId?: string | undefined;
}

export interface CreatePropertyResult {
  property: Property;
  defaultBuilding: Building | undefined;
  customerAssociation: PropertyCustomerAssociation | undefined;
}

export async function createProperty(
  db: DatabaseClient,
  params: CreatePropertyParams,
): Promise<CreatePropertyResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requirePropertiesPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    if (!params.acknowledgeDuplicate) {
      const candidates = await findPotentialDuplicateProperties(tx, params.organizationId, {
        addressLine1: params.addressLine1,
        addressPostalCode: params.addressPostalCode,
      });
      const duplicates = candidates.filter((candidate) =>
        isPotentialDuplicateAddress({
          addressLine1Similarity: candidate.addressLine1Similarity,
          matchedOnExactPostalCode: candidate.matchedOnExactPostalCode,
        }),
      );
      if (duplicates.length > 0) {
        throw new PossibleDuplicatePropertyError(
          duplicates.map((d) => ({ id: d.property.id, addressLine1: d.property.addressLine1 })),
        );
      }
    }

    const property = await insertProperty(tx, {
      organizationId: params.organizationId,
      propertyType: params.propertyType,
      addressLine1: params.addressLine1,
      addressLine2: params.addressLine2,
      addressCity: params.addressCity,
      addressRegion: params.addressRegion,
      addressPostalCode: params.addressPostalCode,
      addressCountry: params.addressCountry,
      latitude: params.latitude,
      longitude: params.longitude,
      accessNotes: params.accessNotes,
    });

    let defaultBuilding: Building | undefined;
    if (shouldProvisionDefaultBuilding(params.propertyType)) {
      defaultBuilding = await insertBuilding(tx, {
        organizationId: params.organizationId,
        propertyId: property.id,
        name: DEFAULT_BUILDING_NAME,
      });
    }

    let customerAssociation: PropertyCustomerAssociation | undefined;
    if (params.customerId) {
      const customer = await findCustomerForOrganization(tx, {
        organizationId: params.organizationId,
        customerId: params.customerId,
      });
      if (!customer) {
        throw new NotFoundError('Customer');
      }
      customerAssociation = await insertAssociation(tx, {
        organizationId: params.organizationId,
        propertyId: property.id,
        customerId: params.customerId,
      });
    }

    return { property, defaultBuilding, customerAssociation };
  });
}
