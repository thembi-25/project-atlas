import { and, eq, isNull } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type InventoryLocation = typeof schema.inventoryLocations.$inferSelect;
export type InventoryLocationType = InventoryLocation['type'];

export async function insertInventoryLocation(
  tx: DatabaseClient,
  input: {
    organizationId: string;
    type: InventoryLocationType;
    name: string;
    technicianUserId?: string | null | undefined;
  },
): Promise<InventoryLocation> {
  const [row] = await tx
    .insert(schema.inventoryLocations)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      name: input.name,
      technicianUserId: input.technicianUserId ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create Inventory Location.');
  return row;
}

export async function findInventoryLocationById(
  tx: DatabaseClient,
  id: string,
): Promise<InventoryLocation | undefined> {
  const [row] = await tx
    .select()
    .from(schema.inventoryLocations)
    .where(eq(schema.inventoryLocations.id, id))
    .limit(1);
  return row;
}

export interface UpdateInventoryLocationFields {
  name?: string | undefined;
  technicianUserId?: string | null | undefined;
}

export async function updateInventoryLocationFields(
  tx: DatabaseClient,
  id: string,
  fields: UpdateInventoryLocationFields,
): Promise<InventoryLocation> {
  const [row] = await tx
    .update(schema.inventoryLocations)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.technicianUserId !== undefined
        ? { technicianUserId: fields.technicianUserId }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.inventoryLocations.id, id))
    .returning();
  if (!row) throw new Error('Failed to update Inventory Location.');
  return row;
}

export async function setInventoryLocationDeletedAt(
  tx: DatabaseClient,
  id: string,
): Promise<InventoryLocation> {
  const [row] = await tx
    .update(schema.inventoryLocations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.inventoryLocations.id, id))
    .returning();
  if (!row) throw new Error('Failed to delete Inventory Location.');
  return row;
}

export async function listInventoryLocationsForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<InventoryLocation[]> {
  return tx
    .select()
    .from(schema.inventoryLocations)
    .where(
      and(
        eq(schema.inventoryLocations.organizationId, organizationId),
        isNull(schema.inventoryLocations.deletedAt),
      ),
    )
    .orderBy(schema.inventoryLocations.name);
}
