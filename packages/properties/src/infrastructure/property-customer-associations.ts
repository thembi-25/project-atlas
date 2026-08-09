import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type PropertyCustomerAssociation = typeof schema.propertyCustomerAssociations.$inferSelect;

export interface CreateAssociationInput {
  organizationId: string;
  propertyId: string;
  customerId: string;
  effectiveFrom?: Date | undefined;
}

export async function insertAssociation(
  tx: DatabaseClient,
  input: CreateAssociationInput,
): Promise<PropertyCustomerAssociation> {
  const [association] = await tx
    .insert(schema.propertyCustomerAssociations)
    .values({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      customerId: input.customerId,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    })
    .returning();
  if (!association) {
    throw new Error('Failed to insert property_customer_association');
  }
  return association;
}

/** `effective_to IS NULL` — properties.md's Data Requirements definition of "current." */
export async function findCurrentAssociationForProperty(
  tx: DatabaseClient,
  propertyId: string,
): Promise<PropertyCustomerAssociation | undefined> {
  const [association] = await tx
    .select()
    .from(schema.propertyCustomerAssociations)
    .where(
      and(
        eq(schema.propertyCustomerAssociations.propertyId, propertyId),
        isNull(schema.propertyCustomerAssociations.effectiveTo),
      ),
    )
    .limit(1);
  return association;
}

export async function findAssociationById(
  tx: DatabaseClient,
  associationId: string,
): Promise<PropertyCustomerAssociation | undefined> {
  const [association] = await tx
    .select()
    .from(schema.propertyCustomerAssociations)
    .where(eq(schema.propertyCustomerAssociations.id, associationId))
    .limit(1);
  return association;
}

/** Ends the current association (sets `effective_to`) — used before starting a new one, or standalone to mark a Property as no longer served by any Customer. */
export async function endAssociation(
  tx: DatabaseClient,
  associationId: string,
  effectiveTo: Date,
): Promise<PropertyCustomerAssociation | undefined> {
  const [association] = await tx
    .update(schema.propertyCustomerAssociations)
    .set({ effectiveTo, updatedAt: new Date() })
    .where(eq(schema.propertyCustomerAssociations.id, associationId))
    .returning();
  return association;
}

/** Full history (current + historical), newest first — properties-prd.md §18 acceptance criteria. */
export async function listAssociationsForProperty(
  tx: DatabaseClient,
  propertyId: string,
): Promise<PropertyCustomerAssociation[]> {
  return tx
    .select()
    .from(schema.propertyCustomerAssociations)
    .where(eq(schema.propertyCustomerAssociations.propertyId, propertyId))
    .orderBy(desc(sql`${schema.propertyCustomerAssociations.effectiveFrom}`));
}
