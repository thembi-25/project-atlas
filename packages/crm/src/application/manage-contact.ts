import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { InvalidCustomerStateError, NotFoundError } from '../domain/errors';
import { findCustomerById } from '../infrastructure/customers';
import {
  countActiveContactsForCustomer,
  findContactById,
  insertContact,
  listContactsForCustomer,
  setContactDeletedAt,
  unsetAllPrimaryContacts,
  unsetOtherPrimaryContacts,
  updateContactFields,
  type Contact,
} from '../infrastructure/contacts';
import { requireCustomersPermission } from './authorize';

async function loadCustomerInOrg(tx: DatabaseClient, organizationId: string, customerId: string) {
  const customer = await findCustomerById(tx, customerId);
  if (!customer || customer.organizationId !== organizationId) {
    throw new NotFoundError('Customer');
  }
  return customer;
}

async function loadContactInOrg(tx: DatabaseClient, organizationId: string, contactId: string) {
  const contact = await findContactById(tx, contactId);
  if (!contact || contact.organizationId !== organizationId) {
    throw new NotFoundError('Contact');
  }
  return contact;
}

export interface ListContactsParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}

export async function listContacts(
  db: DatabaseClient,
  params: ListContactsParams,
): Promise<Contact[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'read' });
    await loadCustomerInOrg(tx, params.organizationId, params.customerId);
    return listContactsForCustomer(tx, params.customerId);
  });
}

export interface GetContactParams {
  organizationId: string;
  actorUserId: string;
  contactId: string;
}

export async function getContact(db: DatabaseClient, params: GetContactParams): Promise<Contact> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'read' });
    return loadContactInOrg(tx, params.organizationId, params.contactId);
  });
}

export interface CreateContactParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  roleTitle?: string | undefined;
  isPrimary?: boolean | undefined;
  portalAccessEnabled?: boolean | undefined;
}

export async function createContact(
  db: DatabaseClient,
  params: CreateContactParams,
): Promise<Contact> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'write' });
    await loadCustomerInOrg(tx, params.organizationId, params.customerId);

    if (params.isPrimary) {
      await unsetAllPrimaryContacts(tx, params.customerId);
    }

    return insertContact(tx, {
      organizationId: params.organizationId,
      customerId: params.customerId,
      name: params.name,
      phone: params.phone,
      email: params.email,
      roleTitle: params.roleTitle,
      isPrimary: params.isPrimary ?? false,
      portalAccessEnabled: params.portalAccessEnabled,
    });
  });
}

export interface UpdateContactParams {
  organizationId: string;
  actorUserId: string;
  contactId: string;
  fields: {
    name?: string | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    roleTitle?: string | null | undefined;
    isPrimary?: boolean | undefined;
    portalAccessEnabled?: boolean | undefined;
  };
}

export async function updateContact(
  db: DatabaseClient,
  params: UpdateContactParams,
): Promise<Contact> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'write' });
    const existing = await loadContactInOrg(tx, params.organizationId, params.contactId);

    if (params.fields.isPrimary === true) {
      await unsetOtherPrimaryContacts(tx, existing.customerId, existing.id);
    }

    const updated = await updateContactFields(tx, params.contactId, params.fields);
    if (!updated) {
      throw new NotFoundError('Contact');
    }
    return updated;
  });
}

export interface ArchiveContactParams {
  organizationId: string;
  actorUserId: string;
  contactId: string;
}

/** contacts.md business rule 1 ("every Customer has at least one Contact") applied to deletion: the last active Contact cannot be archived. */
export async function archiveContact(
  db: DatabaseClient,
  params: ArchiveContactParams,
): Promise<Contact> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'delete' });
    const existing = await loadContactInOrg(tx, params.organizationId, params.contactId);

    const activeCount = await countActiveContactsForCustomer(tx, existing.customerId);
    if (activeCount <= 1) {
      throw new InvalidCustomerStateError(
        'Cannot remove the last remaining Contact on a Customer — every Customer must have at least one Contact.',
      );
    }

    const archived = await setContactDeletedAt(tx, params.contactId, new Date());
    if (!archived) {
      throw new NotFoundError('Contact');
    }
    return archived;
  });
}

export interface RestoreContactParams {
  organizationId: string;
  actorUserId: string;
  contactId: string;
}

export async function restoreContact(
  db: DatabaseClient,
  params: RestoreContactParams,
): Promise<Contact> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'delete' });
    const contact = await findContactById(tx, params.contactId, { includeDeleted: true });
    if (!contact || contact.organizationId !== params.organizationId) {
      throw new NotFoundError('Contact');
    }
    const restored = await setContactDeletedAt(tx, params.contactId, null);
    if (!restored) {
      throw new NotFoundError('Contact');
    }
    return restored;
  });
}
