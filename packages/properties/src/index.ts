/**
 * Properties domain module — Properties, Buildings, Rooms (and read access
 * to Asset history for the Property service-history endpoint). See
 * docs/13-roadmap/sprint-3.md, docs/03-domain/properties.md,
 * docs/03-domain/buildings.md, docs/03-domain/rooms.md,
 * docs/06-modules/properties-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 *
 * Architecture note: component-architecture.md's module-responsibility
 * table defines one architectural module, "properties", owning
 * `properties`, `buildings`, `rooms`, *and* `assets` together. Sprint 0
 * scaffolded @atlas/properties and @atlas/assets as two separate
 * TypeScript packages; Sprint 3 honors that concrete package split (kept
 * for file-organization/package-size reasons) while treating both
 * packages as jointly implementing that single documented module — so
 * either package's infrastructure may query any of the four
 * `properties`-schema tables directly (see e.g.
 * infrastructure/asset-history.ts), and other, genuinely separate modules
 * (crm, jobs, etc.) call through this package's application-layer exports
 * per the usual module-boundary rule. See
 * docs/13-roadmap/SPRINT-3-COMPLETION-REPORT.md, "Architecture Decisions."
 */

// Domain
export {
  NotFoundError,
  ForbiddenError,
  PropertyHasActiveRecordsError,
  BuildingHasActiveRecordsError,
  RoomHasActiveRecordsError,
  PossibleDuplicatePropertyError,
} from './domain/errors';
export { DEFAULT_BUILDING_NAME, shouldProvisionDefaultBuilding } from './domain/default-building';
export {
  isPotentialDuplicateAddress,
  ADDRESS_LINE1_SIMILARITY_THRESHOLD,
  type AddressDuplicateSignal,
} from './domain/duplicate-detection';

// Application use cases
export { createProperty } from './application/create-property';
export type { CreatePropertyParams, CreatePropertyResult } from './application/create-property';
export {
  getProperty,
  listProperties,
  searchProperties,
  updateProperty,
  archiveProperty,
  restoreProperty,
} from './application/manage-property';
export type {
  GetPropertyParams,
  ListPropertiesParams,
  SearchPropertiesParams,
  UpdatePropertyParams,
  ArchivePropertyParams,
  RestorePropertyParams,
} from './application/manage-property';
export { getPropertyHistory } from './application/property-history';
export type {
  GetPropertyHistoryParams,
  PropertyHistoryResult,
} from './application/property-history';
export {
  addCustomerAssociation,
  endCustomerAssociation,
  listCustomerAssociations,
} from './application/manage-customer-association';
export type {
  AddCustomerAssociationParams,
  EndCustomerAssociationParams,
  ListCustomerAssociationsParams,
} from './application/manage-customer-association';
export {
  createBuilding,
  getBuilding,
  listBuildings,
  updateBuilding,
  archiveBuilding,
} from './application/manage-building';
export type {
  CreateBuildingParams,
  GetBuildingParams,
  ListBuildingsParams,
  UpdateBuildingParams,
  ArchiveBuildingParams,
} from './application/manage-building';
export { createRoom, getRoom, listRooms, updateRoom, archiveRoom } from './application/manage-room';
export type {
  CreateRoomParams,
  GetRoomParams,
  ListRoomsParams,
  UpdateRoomParams,
  ArchiveRoomParams,
} from './application/manage-room';

// Cross-module read (see @atlas/assets, which depends on this package
// only indirectly — in practice it queries the shared `properties` schema
// directly per the architecture note above; this export exists for any
// other, genuinely separate module that needs a permission-agnostic
// existence + tenant-ownership check).
export { findPropertyById } from './infrastructure/properties';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type {
  Property,
  PropertyType,
  PropertyCursor,
  PropertySortField,
  SortDirection,
  PropertySearchHit,
} from './infrastructure/properties';
export type { PropertyCustomerAssociation } from './infrastructure/property-customer-associations';
export type { Building, BuildingType } from './infrastructure/buildings';
export type { Room, RoomType } from './infrastructure/rooms';
export type { AssetHistoryEntry } from './infrastructure/asset-history';
