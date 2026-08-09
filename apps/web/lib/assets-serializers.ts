import type { Asset, AssetType } from '@atlas/assets';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeAsset(asset: Asset) {
  return {
    id: asset.id,
    organization_id: asset.organizationId,
    property_id: asset.propertyId,
    building_id: asset.buildingId,
    room_id: asset.roomId,
    asset_type_id: asset.assetTypeId,
    manufacturer_name: asset.manufacturerName,
    model_number: asset.modelNumber,
    serial_number: asset.serialNumber,
    install_date: asset.installDate,
    status: asset.status,
    deleted_at: asset.deletedAt ? asset.deletedAt.toISOString() : null,
    created_at: asset.createdAt.toISOString(),
    updated_at: asset.updatedAt.toISOString(),
  };
}

export function serializeAssetType(assetType: AssetType) {
  return {
    id: assetType.id,
    organization_id: assetType.organizationId,
    trade_type_id: assetType.tradeTypeId,
    name: assetType.name,
    is_active: assetType.isActive,
    created_at: assetType.createdAt.toISOString(),
    updated_at: assetType.updatedAt.toISOString(),
  };
}
