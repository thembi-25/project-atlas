import type { DatabaseClient } from '@atlas/database';
import { findContactById, type Contact } from '../infrastructure/contacts';

/**
 * Cross-module read for other Organization-scoped modules that need to
 * verify a Contact exists and belongs to the caller's Organization before
 * creating a cross-table reference to it — mirrors `findCustomerForOrganization`
 * exactly (see that function's docstring for the full rationale). Added
 * for @atlas/jobs's optional `contact_id` (the specific on-site Contact
 * for a Job — docs/03-domain/jobs.md, "Key attributes"), Sprint 4.
 */
export async function findContactForOrganization(
  tx: DatabaseClient,
  params: { organizationId: string; contactId: string },
): Promise<Contact | undefined> {
  const contact = await findContactById(tx, params.contactId);
  if (!contact || contact.organizationId !== params.organizationId) {
    return undefined;
  }
  return contact;
}
