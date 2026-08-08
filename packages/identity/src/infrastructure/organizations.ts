import { eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export interface CreateOrganizationInput {
  name: string;
  legalName?: string | undefined;
  businessEmail?: string | undefined;
  businessPhone?: string | undefined;
  timezone?: string | undefined;
  locale?: string | undefined;
  tradeTypeIds: readonly string[];
}

export async function insertOrganization(
  tx: DatabaseClient,
  input: CreateOrganizationInput,
): Promise<typeof schema.organizations.$inferSelect> {
  const [organization] = await tx
    .insert(schema.organizations)
    .values({
      name: input.name,
      legalName: input.legalName ?? null,
      businessEmail: input.businessEmail ?? null,
      businessPhone: input.businessPhone ?? null,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'en-US',
    })
    .returning();

  if (!organization) {
    throw new Error('Failed to insert organization');
  }

  if (input.tradeTypeIds.length > 0) {
    await tx.insert(schema.organizationTradeTypes).values(
      input.tradeTypeIds.map((tradeTypeId) => ({
        organizationId: organization.id,
        tradeTypeId,
      })),
    );
  }

  return organization;
}

export async function findOrganizationById(
  tx: DatabaseClient,
  organizationId: string,
): Promise<typeof schema.organizations.$inferSelect | undefined> {
  const [organization] = await tx
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  return organization;
}
