import type {
  AssetHistoryEntry,
  Building,
  Property,
  PropertyCustomerAssociation,
  Room,
} from '@atlas/properties';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeProperty(property: Property) {
  return {
    id: property.id,
    organization_id: property.organizationId,
    property_type: property.propertyType,
    address_line1: property.addressLine1,
    address_line2: property.addressLine2,
    address_city: property.addressCity,
    address_region: property.addressRegion,
    address_postal_code: property.addressPostalCode,
    address_country: property.addressCountry,
    latitude: property.latitude,
    longitude: property.longitude,
    access_notes: property.accessNotes,
    deleted_at: property.deletedAt ? property.deletedAt.toISOString() : null,
    created_at: property.createdAt.toISOString(),
    updated_at: property.updatedAt.toISOString(),
  };
}

export function serializeBuilding(building: Building) {
  return {
    id: building.id,
    organization_id: building.organizationId,
    property_id: building.propertyId,
    name: building.name,
    building_type: building.buildingType,
    floor_count: building.floorCount,
    year_built: building.yearBuilt,
    deleted_at: building.deletedAt ? building.deletedAt.toISOString() : null,
    created_at: building.createdAt.toISOString(),
    updated_at: building.updatedAt.toISOString(),
  };
}

export function serializeRoom(room: Room) {
  return {
    id: room.id,
    organization_id: room.organizationId,
    building_id: room.buildingId,
    name: room.name,
    room_type: room.roomType,
    floor_level: room.floorLevel,
    deleted_at: room.deletedAt ? room.deletedAt.toISOString() : null,
    created_at: room.createdAt.toISOString(),
    updated_at: room.updatedAt.toISOString(),
  };
}

export function serializePropertyCustomerAssociation(association: PropertyCustomerAssociation) {
  return {
    id: association.id,
    organization_id: association.organizationId,
    property_id: association.propertyId,
    customer_id: association.customerId,
    effective_from: association.effectiveFrom.toISOString(),
    effective_to: association.effectiveTo ? association.effectiveTo.toISOString() : null,
    created_at: association.createdAt.toISOString(),
    updated_at: association.updatedAt.toISOString(),
  };
}

export function serializeAssetHistoryEntry(entry: AssetHistoryEntry) {
  return {
    id: entry.id,
    asset_type_id: entry.assetTypeId,
    manufacturer_name: entry.manufacturerName,
    model_number: entry.modelNumber,
    serial_number: entry.serialNumber,
    install_date: entry.installDate,
    status: entry.status,
    building_id: entry.buildingId,
    room_id: entry.roomId,
    created_at: entry.createdAt.toISOString(),
  };
}
