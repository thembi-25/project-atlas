import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Contact = typeof schema.contacts.$inferSelect;

export interface CreateContactInput {
  organizationId: string;
  customerId: string;
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  roleTitle?: string | undefined;
  isPrimary?: boolean | undefined;
  portalAccessEnabled?: boolean | undefined;
}

export async function insertContact(
  tx: DatabaseClient,
  input: CreateContactInput,
): Promise<Contact> {
  const [contact] = await tx
    .insert(schema.contacts)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      roleTitle: input.roleTitle ?? null,
      isPrimary: input.isPrimary ?? false,
      portalAccessEnabled: input.portalAccessEnabled ?? false,
    })
    .returning();
  if (!contact) {
    throw new Error('Failed to insert contact');
  }
  return contact;
}

export async function findContactById(
  tx: DatabaseClient,
  contactId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Contact | undefined> {
  const conditions = [eq(schema.contacts.id, contactId)];
  if (!options.includeDeleted) {
    conditions.push(isNull(schema.contacts.deletedAt));
  }
  const [contact] = await tx
    .select()
    .from(schema.contacts)
    .where(and(...conditions))
    .limit(1);
  return contact;
}

export async function listContactsForCustomer(
  tx: DatabaseClient,
  customerId: string,
): Promise<Contact[]> {
  return tx
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.customerId, customerId), isNull(schema.contacts.deletedAt)))
    .orderBy(sql`${schema.contacts.isPrimary} DESC, ${schema.contacts.createdAt} ASC`);
}

export async function findPrimaryContact(
  tx: DatabaseClient,
  customerId: string,
): Promise<Contact | undefined> {
  const [contact] = await tx
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.customerId, customerId),
        eq(schema.contacts.isPrimary, true),
        isNull(schema.contacts.deletedAt),
      ),
    )
    .limit(1);
  return contact;
}

/** Clears `is_primary` on every other Contact of this Customer — contacts.md business rule 2. */
export async function unsetOtherPrimaryContacts(
  tx: DatabaseClient,
  customerId: string,
  exceptContactId: string,
): Promise<void> {
  await tx
    .update(schema.contacts)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.contacts.customerId, customerId),
        eq(schema.contacts.isPrimary, true),
        sql`${schema.contacts.id} <> ${exceptContactId}`,
      ),
    );
}

/** Clears `is_primary` on every Contact of this Customer — used before inserting a new primary Contact. */
export async function unsetAllPrimaryContacts(
  tx: DatabaseClient,
  customerId: string,
): Promise<void> {
  await tx
    .update(schema.contacts)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(schema.contacts.customerId, customerId), eq(schema.contacts.isPrimary, true)));
}

export interface UpdateContactFields {
  name?: string | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  roleTitle?: string | null | undefined;
  isPrimary?: boolean | undefined;
  portalAccessEnabled?: boolean | undefined;
}

export async function updateContactFields(
  tx: DatabaseClient,
  contactId: string,
  fields: UpdateContactFields,
): Promise<Contact | undefined> {
  const [contact] = await tx
    .update(schema.contacts)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
      ...(fields.email !== undefined ? { email: fields.email } : {}),
      ...(fields.roleTitle !== undefined ? { roleTitle: fields.roleTitle } : {}),
      ...(fields.isPrimary !== undefined ? { isPrimary: fields.isPrimary } : {}),
      ...(fields.portalAccessEnabled !== undefined
        ? { portalAccessEnabled: fields.portalAccessEnabled }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.contacts.id, contactId), isNull(schema.contacts.deletedAt)))
    .returning();
  return contact;
}

export async function setContactDeletedAt(
  tx: DatabaseClient,
  contactId: string,
  deletedAt: Date | null,
): Promise<Contact | undefined> {
  const [contact] = await tx
    .update(schema.contacts)
    .set({ deletedAt, updatedAt: new Date() })
    .where(eq(schema.contacts.id, contactId))
    .returning();
  return contact;
}

export async function countActiveContactsForCustomer(
  tx: DatabaseClient,
  customerId: string,
): Promise<number> {
  const rows = await tx
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(and(eq(schema.contacts.customerId, customerId), isNull(schema.contacts.deletedAt)));
  return rows.length;
}

/**
 * Sprint 5 (Customer Portal): every portal-access-enabled Contact row
 * matching this email, across every Organization — a person can be a
 * Contact for more than one Organization under the same email, and the
 * Portal's magic-link request step (docs/13-roadmap/sprint-5.md) must
 * discover all of them, not just one.
 */
export async function findPortalContactsByEmail(
  tx: DatabaseClient,
  email: string,
): Promise<Contact[]> {
  return tx
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.email, email),
        eq(schema.contacts.portalAccessEnabled, true),
        isNull(schema.contacts.deletedAt),
      ),
    );
}

/** Links a Contact to its Portal authentication identity on first successful magic-link verification — see @atlas/database's `withServiceContext` usage in the Portal auth application layer. */
export async function linkContactPortalUser(
  tx: DatabaseClient,
  contactId: string,
  portalUserId: string,
): Promise<Contact | undefined> {
  const [contact] = await tx
    .update(schema.contacts)
    .set({ portalUserId, updatedAt: new Date() })
    .where(eq(schema.contacts.id, contactId))
    .returning();
  return contact;
}

/** The Contact identity behind a Portal session, scoped to one Customer — used to verify a Portal actor's Estimate/Invoice/Payment access before a `withServiceContext` write. */
export async function findContactByPortalUserAndCustomer(
  tx: DatabaseClient,
  params: { portalUserId: string; customerId: string },
): Promise<Contact | undefined> {
  const [contact] = await tx
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.portalUserId, params.portalUserId),
        eq(schema.contacts.customerId, params.customerId),
        eq(schema.contacts.portalAccessEnabled, true),
        isNull(schema.contacts.deletedAt),
      ),
    )
    .limit(1);
  return contact;
}

/** Every Contact (across Organizations) linked to this Portal user — used to resolve "which Customers can this Portal session see." */
export async function listContactsByPortalUserId(
  tx: DatabaseClient,
  portalUserId: string,
): Promise<Contact[]> {
  return tx
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.portalUserId, portalUserId),
        eq(schema.contacts.portalAccessEnabled, true),
        isNull(schema.contacts.deletedAt),
      ),
    );
}
