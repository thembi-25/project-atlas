import { and, eq, isNull, or } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type ServiceCategory = typeof schema.serviceCategories.$inferSelect;

/** Platform defaults plus this Organization's own extensions — mirrors `listJobTypesForOrganization`. */
export async function listServiceCategoriesForOrganization(
  tx: DatabaseClient,
  organizationId: string,
): Promise<ServiceCategory[]> {
  return tx
    .select()
    .from(schema.serviceCategories)
    .where(
      and(
        or(
          isNull(schema.serviceCategories.organizationId),
          eq(schema.serviceCategories.organizationId, organizationId),
        ),
        eq(schema.serviceCategories.isActive, true),
      ),
    )
    .orderBy(schema.serviceCategories.name);
}

export async function findServiceCategoryById(
  tx: DatabaseClient,
  serviceCategoryId: string,
): Promise<ServiceCategory | undefined> {
  const [category] = await tx
    .select()
    .from(schema.serviceCategories)
    .where(eq(schema.serviceCategories.id, serviceCategoryId))
    .limit(1);
  return category;
}

/** True when the Service Category is a platform default or belongs to this Organization. */
export function serviceCategoryVisibleToOrganization(
  category: ServiceCategory,
  organizationId: string,
): boolean {
  return category.organizationId === null || category.organizationId === organizationId;
}
