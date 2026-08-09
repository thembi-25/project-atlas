import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Building = typeof schema.buildings.$inferSelect;
export type BuildingType = NonNullable<Building['buildingType']>;

export interface CreateBuildingInput {
  organizationId: string;
  propertyId: string;
  name: string;
  buildingType?: BuildingType | undefined;
  floorCount?: number | undefined;
  yearBuilt?: number | undefined;
}

export async function insertBuilding(
  tx: DatabaseClient,
  input: CreateBuildingInput,
): Promise<Building> {
  const [building] = await tx
    .insert(schema.buildings)
    .values({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      name: input.name,
      buildingType: input.buildingType ?? null,
      floorCount: input.floorCount ?? null,
      yearBuilt: input.yearBuilt ?? null,
    })
    .returning();
  if (!building) {
    throw new Error('Failed to insert building');
  }
  return building;
}

export async function findBuildingById(
  tx: DatabaseClient,
  buildingId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Building | undefined> {
  const conditions = [eq(schema.buildings.id, buildingId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.buildings.deletedAt));
  }
  const [building] = await tx
    .select()
    .from(schema.buildings)
    .where(and(...conditions))
    .limit(1);
  return building;
}

export async function listBuildingsForProperty(
  tx: DatabaseClient,
  propertyId: string,
): Promise<Building[]> {
  return tx
    .select()
    .from(schema.buildings)
    .where(and(eq(schema.buildings.propertyId, propertyId), isNull(schema.buildings.deletedAt)))
    .orderBy(schema.buildings.createdAt);
}

export interface UpdateBuildingFields {
  name?: string | undefined;
  buildingType?: BuildingType | null | undefined;
  floorCount?: number | null | undefined;
  yearBuilt?: number | null | undefined;
}

export async function updateBuildingFields(
  tx: DatabaseClient,
  buildingId: string,
  fields: UpdateBuildingFields,
): Promise<Building | undefined> {
  const [building] = await tx
    .update(schema.buildings)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.buildingType !== undefined ? { buildingType: fields.buildingType } : {}),
      ...(fields.floorCount !== undefined ? { floorCount: fields.floorCount } : {}),
      ...(fields.yearBuilt !== undefined ? { yearBuilt: fields.yearBuilt } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.buildings.id, buildingId), isNull(schema.buildings.deletedAt)))
    .returning();
  return building;
}

export async function setBuildingDeletedAt(
  tx: DatabaseClient,
  buildingId: string,
  deletedAt: Date | null,
): Promise<Building | undefined> {
  const [building] = await tx
    .update(schema.buildings)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.buildings.id, buildingId))
    .returning();
  return building;
}

/** buildings.md business rule 2: blocked while it has any non-deleted Room or Asset. */
export async function hasActiveChildrenForBuilding(
  tx: DatabaseClient,
  buildingId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM properties.rooms r WHERE r.building_id = ${buildingId}::uuid AND r.deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM properties.assets a WHERE a.building_id = ${buildingId}::uuid AND a.deleted_at IS NULL
    ) AS exists
  `);
  return rows[0]?.exists ?? false;
}
