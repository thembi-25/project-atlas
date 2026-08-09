import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { InvalidAssetStateError, NotFoundError } from '../domain/errors';
import { canTransitionAssetStatus, type AssetStatus } from '../domain/lifecycle';
import { findAssetTypeById, assetTypeVisibleToOrganization } from '../infrastructure/asset-types';
import {
  findAssetById,
  listAssetsForOrganization,
  searchAssets as searchAssetsInfra,
  setAssetDeletedAt,
  setAssetStatus,
  updateAssetFields,
  type Asset,
  type AssetCursor,
  type AssetSearchHit,
  type SortDirection,
} from '../infrastructure/assets';
import { buildingExistsForProperty, roomExistsForBuilding } from '../infrastructure/property-links';
import { requireAssetsPermission } from './authorize';

export interface GetAssetParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
}

export async function getAsset(db: DatabaseClient, params: GetAssetParams): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'read' });
    const asset = await findAssetById(tx, params.assetId);
    if (!asset || asset.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }
    return asset;
  });
}

export interface ListAssetsParams {
  organizationId: string;
  actorUserId: string;
  propertyId?: string | undefined;
  limit: number;
  cursor?: AssetCursor | undefined;
  sortDirection: SortDirection;
  status?: AssetStatus | undefined;
}

export async function listAssets(
  db: DatabaseClient,
  params: ListAssetsParams,
): Promise<{ rows: Asset[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'read' });
    return listAssetsForOrganization(tx, params);
  });
}

export interface SearchAssetsParams {
  organizationId: string;
  actorUserId: string;
  query: string;
  limit: number;
}

export async function searchAssets(
  db: DatabaseClient,
  params: SearchAssetsParams,
): Promise<AssetSearchHit[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'read' });
    return searchAssetsInfra(tx, params.organizationId, params.query, params.limit);
  });
}

export interface UpdateAssetParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
  fields: {
    buildingId?: string | null | undefined;
    roomId?: string | null | undefined;
    assetTypeId?: string | undefined;
    manufacturerName?: string | null | undefined;
    modelNumber?: string | null | undefined;
    serialNumber?: string | null | undefined;
    installDate?: string | null | undefined;
  };
}

/** Ordinary field edits only — never `status` (see `transitionAssetStatus`). */
export async function updateAsset(db: DatabaseClient, params: UpdateAssetParams): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'write' });
    const existing = await findAssetById(tx, params.assetId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }

    const nextBuildingId =
      params.fields.buildingId !== undefined ? params.fields.buildingId : existing.buildingId;
    const nextRoomId = params.fields.roomId !== undefined ? params.fields.roomId : existing.roomId;
    if (nextRoomId && !nextBuildingId) {
      throw new NotFoundError('Building');
    }
    if (
      nextBuildingId &&
      !(await buildingExistsForProperty(
        tx,
        params.organizationId,
        existing.propertyId,
        nextBuildingId,
      ))
    ) {
      throw new NotFoundError('Building');
    }
    if (
      nextRoomId &&
      nextBuildingId &&
      !(await roomExistsForBuilding(tx, params.organizationId, nextBuildingId, nextRoomId))
    ) {
      throw new NotFoundError('Room');
    }
    if (params.fields.assetTypeId) {
      const assetType = await findAssetTypeById(tx, params.fields.assetTypeId);
      if (!assetType || !assetTypeVisibleToOrganization(assetType, params.organizationId)) {
        throw new NotFoundError('AssetType');
      }
    }

    const updated = await updateAssetFields(tx, params.assetId, params.fields);
    if (!updated) {
      throw new NotFoundError('Asset');
    }
    return updated;
  });
}

export interface TransitionAssetStatusParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
  /** assets-prd.md §11: `POST /api/v1/assets/{id}/decommission`, defaulting to `decommissioned`; `removed` is the documented alternative terminal outcome (assets.md, "Key attributes" — status: active, removed, decommissioned). */
  status: Extract<AssetStatus, 'removed' | 'decommissioned'>;
}

/** assets.md business rules 2/3: one-way lifecycle transition; the Asset row remains visible in Property history afterward. */
export async function transitionAssetStatus(
  db: DatabaseClient,
  params: TransitionAssetStatusParams,
): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'write' });
    const existing = await findAssetById(tx, params.assetId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }
    if (!canTransitionAssetStatus(existing.status, params.status)) {
      throw new InvalidAssetStateError(
        `Cannot transition Asset status from '${existing.status}' to '${params.status}'.`,
      );
    }
    const updated = await setAssetStatus(tx, params.assetId, params.status);
    if (!updated) {
      throw new NotFoundError('Asset');
    }
    return updated;
  });
}

export interface ArchiveAssetParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
}

/** Soft delete (distinct from `transitionAssetStatus` — see resource-conventions.md, DELETE is always a soft delete). */
export async function archiveAsset(db: DatabaseClient, params: ArchiveAssetParams): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'delete' });
    const existing = await findAssetById(tx, params.assetId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }
    const archived = await setAssetDeletedAt(tx, params.assetId, new Date());
    if (!archived) {
      throw new NotFoundError('Asset');
    }
    return archived;
  });
}

export interface RestoreAssetParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
}

/** soft-deletion.md rule 4: restore is Admin/Owner only — enforced via `assets:delete`, granted only to those Roles. */
export async function restoreAsset(db: DatabaseClient, params: RestoreAssetParams): Promise<Asset> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'delete' });
    const existing = await findAssetById(tx, params.assetId, { includeDeleted: true });
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }
    const restored = await setAssetDeletedAt(tx, params.assetId, null);
    if (!restored) {
      throw new NotFoundError('Asset');
    }
    return restored;
  });
}

/**
 * assets.md, "API requirements": a service-history endpoint returning all
 * Jobs referencing the Asset. Jobs does not exist until Sprint 4, so this
 * always returns an empty array — see
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Known Limitations."
 */
export interface GetAssetHistoryParams {
  organizationId: string;
  actorUserId: string;
  assetId: string;
}

export interface AssetHistoryResult {
  asset: Asset;
  jobs: [];
}

export async function getAssetHistory(
  db: DatabaseClient,
  params: GetAssetHistoryParams,
): Promise<AssetHistoryResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireAssetsPermission(tx, { ...params, action: 'read' });
    const asset = await findAssetById(tx, params.assetId);
    if (!asset || asset.organizationId !== params.organizationId) {
      throw new NotFoundError('Asset');
    }
    return { asset, jobs: [] };
  });
}
