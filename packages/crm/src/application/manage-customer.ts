import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import {
  findCustomerById,
  listCustomersForOrganization,
  searchCustomers as searchCustomersInfra,
  setCustomerDeletedAt,
  updateCustomerFields,
  type Customer,
  type CustomerCursor,
  type CustomerSearchHit,
  type CustomerSortField,
  type SortDirection,
} from '../infrastructure/customers';
import { requireCustomersPermission } from './authorize';

export interface GetCustomerParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}

export async function getCustomer(
  db: DatabaseClient,
  params: GetCustomerParams,
): Promise<Customer> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'read' });
    const customer = await findCustomerById(tx, params.customerId);
    if (!customer || customer.organizationId !== params.organizationId) {
      throw new NotFoundError('Customer');
    }
    return customer;
  });
}

export interface ListCustomersParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: CustomerCursor | undefined;
  sortField: CustomerSortField;
  sortDirection: SortDirection;
  type?: 'residential' | 'commercial' | undefined;
}

export async function listCustomers(
  db: DatabaseClient,
  params: ListCustomersParams,
): Promise<{ rows: Customer[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'read' });
    return listCustomersForOrganization(tx, params);
  });
}

export interface SearchCustomersParams {
  organizationId: string;
  actorUserId: string;
  query: string;
  limit: number;
}

export async function searchCustomers(
  db: DatabaseClient,
  params: SearchCustomersParams,
): Promise<CustomerSearchHit[]> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'read' });
    return searchCustomersInfra(tx, params.organizationId, params.query, params.limit);
  });
}

export interface UpdateCustomerParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
  fields: {
    type?: 'residential' | 'commercial' | undefined;
    displayName?: string | undefined;
    billingAddressLine1?: string | null | undefined;
    billingAddressLine2?: string | null | undefined;
    billingAddressCity?: string | null | undefined;
    billingAddressRegion?: string | null | undefined;
    billingAddressPostalCode?: string | null | undefined;
    billingAddressCountry?: string | null | undefined;
    tags?: readonly string[] | undefined;
    notes?: string | null | undefined;
    portalAccessEnabled?: boolean | undefined;
  };
}

export async function updateCustomer(
  db: DatabaseClient,
  params: UpdateCustomerParams,
): Promise<Customer> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'write' });
    const existing = await findCustomerById(tx, params.customerId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Customer');
    }
    const updated = await updateCustomerFields(tx, params.customerId, params.fields);
    if (!updated) {
      throw new NotFoundError('Customer');
    }
    return updated;
  });
}

export interface ArchiveCustomerParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}

/**
 * customers-prd.md §16: blocking deletion of a Customer with active
 * Jobs/Estimates/Invoices is documented but those modules do not exist
 * yet this sprint — see SPRINT-2-COMPLETION-REPORT.md, "Known
 * Limitations." There is currently nothing that could block an archive.
 */
export async function archiveCustomer(
  db: DatabaseClient,
  params: ArchiveCustomerParams,
): Promise<Customer> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'delete' });
    const existing = await findCustomerById(tx, params.customerId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Customer');
    }
    const archived = await setCustomerDeletedAt(tx, params.customerId, new Date());
    if (!archived) {
      throw new NotFoundError('Customer');
    }
    return archived;
  });
}

export interface RestoreCustomerParams {
  organizationId: string;
  actorUserId: string;
  customerId: string;
}

/** soft-deletion.md rule 4: restore is Admin/Owner only — enforced via `customers:delete`, granted only to those Roles. */
export async function restoreCustomer(
  db: DatabaseClient,
  params: RestoreCustomerParams,
): Promise<Customer> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, { ...params, action: 'delete' });
    const existing = await findCustomerById(tx, params.customerId, { includeDeleted: true });
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Customer');
    }
    const restored = await setCustomerDeletedAt(tx, params.customerId, null);
    if (!restored) {
      throw new NotFoundError('Customer');
    }
    return restored;
  });
}
