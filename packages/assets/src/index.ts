/**
 * Assets domain module — installed equipment tracked over its full
 * lifecycle. See docs/13-roadmap/sprint-3.md, docs/03-domain/assets.md,
 * docs/06-modules/assets-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 *
 * Architecture note: this package's infrastructure queries
 * `properties.properties`/`buildings`/`rooms` directly (see
 * infrastructure/property-links.ts) rather than through @atlas/properties.
 * See that package's index.ts for the full reasoning — both packages
 * jointly implement component-architecture.md's single "properties"
 * architectural module (properties, buildings, rooms, assets).
 */

// Domain
export { NotFoundError, ForbiddenError, InvalidAssetStateError } from './domain/errors';
export {
  canTransitionAssetStatus,
  TERMINAL_ASSET_STATUSES,
  type AssetStatus,
} from './domain/lifecycle';

// Application use cases
export { createAsset } from './application/create-asset';
export type { CreateAssetParams } from './application/create-asset';
export {
  getAsset,
  listAssets,
  searchAssets,
  updateAsset,
  transitionAssetStatus,
  archiveAsset,
  restoreAsset,
  getAssetHistory,
} from './application/manage-asset';
export type {
  GetAssetParams,
  ListAssetsParams,
  SearchAssetsParams,
  UpdateAssetParams,
  TransitionAssetStatusParams,
  ArchiveAssetParams,
  RestoreAssetParams,
  GetAssetHistoryParams,
  AssetHistoryResult,
} from './application/manage-asset';
export { listAssetTypes } from './application/list-asset-types';
export type { ListAssetTypesParams } from './application/list-asset-types';
export { findAssetForOrganization } from './application/verify-asset';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type {
  Asset,
  AssetCursor,
  AssetSortField,
  SortDirection,
  AssetSearchHit,
} from './infrastructure/assets';
export type { AssetType } from './infrastructure/asset-types';
