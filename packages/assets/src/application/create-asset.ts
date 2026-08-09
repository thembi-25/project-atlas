import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import { findAssetTypeById, assetTypeVisibleToOrganization } from '../infrastructure/asset-types';
import { insertAsset, type Asset } from '../infrastructure/assets';
import {
  buildingExistsForProperty,
  propertyExistsForOrganization,
  roomExistsForBuilding,
} from '../infrastructure/property-links';
import { requireAssetsPermission } from './authorize';

export interface CreateAssetParams {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  buildingId?: string | undefined;
  roomId?: string | undefined;
  assetTypeId: string;
  manufacturerName?: string | undefined;
  modelNumber?: string | undefined;
  serialNumber?: string | undefined;
  installDate?: string | undefined;
}

/**
 * assets.md: `property_id` is required; `building_id`/`room_id` are
 * optional precision. When `room_id` is given, `building_id` must also be
 * given and the Room must belong to that Building (rooms.md — a Room
 * never exists without a Building). Every parent reference is verified to
 * exist, be non-deleted, and belong to the caller's Organization *before*
 * the insert — application-layer defense-in-depth alongside the
 * database's own RLS `WITH CHECK` clauses on `properties.assets` (see
 * docs/07-security/tenant-isolation.md).
 */
export async function createAsset(db: DatabaseClient, params: CreateAssetParams): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    if (!(await propertyExistsForOrganization(tx, params.organizationId, params.propertyId))) {
      throw new NotFoundError('Property');
    }
    if (params.roomId && !params.buildingId) {
      throw new NotFoundError('Building');
    }
    if (
      params.buildingId &&
      !(await buildingExistsForProperty(
        tx,
        params.organizationId,
        params.propertyId,
        params.buildingId,
      ))
    ) {
      throw new NotFoundError('Building');
    }
    if (
      params.roomId &&
      params.buildingId &&
      !(await roomExistsForBuilding(tx, params.organizationId, params.buildingId, params.roomId))
    ) {
      throw new NotFoundError('Room');
    }

    const assetType = await findAssetTypeById(tx, params.assetTypeId);
    if (!assetType || !assetTypeVisibleToOrganization(assetType, params.organizationId)) {
      throw new NotFoundError('AssetType');
    }

    return insertAsset(tx, {
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      buildingId: params.buildingId,
      roomId: params.roomId,
      assetTypeId: params.assetTypeId,
      manufacturerName: params.manufacturerName,
      modelNumber: params.modelNumber,
      serialNumber: params.serialNumber,
      installDate: params.installDate,
    });
  });
}
