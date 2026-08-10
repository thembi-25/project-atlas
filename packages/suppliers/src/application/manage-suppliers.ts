import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { NotFoundError } from '../domain/errors';
import {
  findSupplierById,
  insertSupplier,
  listSuppliersForOrganization,
  setSupplierDeletedAt,
  updateSupplierFields,
  type Supplier,
  type SupplierCursor,
  type SupplierSortField,
  type SortDirection,
  type UpdateSupplierFields,
} from '../infrastructure/suppliers';
import { requireInventoryPermission } from './authorize';

export interface CreateSupplierParams {
  organizationId: string;
  actorUserId: string;
  name: string;
  contactName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  accountNumber?: string | null | undefined;
  notes?: string | null | undefined;
}

export async function createSupplier(
  db: DatabaseClient,
  params: CreateSupplierParams,
): Promise<Supplier> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    return insertSupplier(tx, params);
  });
}

export interface GetSupplierParams {
  organizationId: string;
  actorUserId: string;
  supplierId: string;
}

export async function getSupplier(
  db: DatabaseClient,
  params: GetSupplierParams,
): Promise<Supplier> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    const supplier = await findSupplierById(tx, params.supplierId);
    if (!supplier || supplier.organizationId !== params.organizationId) {
      throw new NotFoundError('Supplier');
    }
    return supplier;
  });
}

export interface ListSuppliersParams {
  organizationId: string;
  actorUserId: string;
  limit: number;
  cursor?: SupplierCursor | undefined;
  sortField: SupplierSortField;
  sortDirection: SortDirection;
}

export async function listSuppliers(
  db: DatabaseClient,
  params: ListSuppliersParams,
): Promise<{ rows: Supplier[]; hasMore: boolean }> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'read' });
    return listSuppliersForOrganization(tx, params);
  });
}

export interface UpdateSupplierParams {
  organizationId: string;
  actorUserId: string;
  supplierId: string;
  fields: UpdateSupplierFields;
}

export async function updateSupplier(
  db: DatabaseClient,
  params: UpdateSupplierParams,
): Promise<Supplier> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findSupplierById(tx, params.supplierId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Supplier');
    }
    return updateSupplierFields(tx, params.supplierId, params.fields);
  });
}

export interface DeleteSupplierParams {
  organizationId: string;
  actorUserId: string;
  supplierId: string;
}

export async function deleteSupplier(
  db: DatabaseClient,
  params: DeleteSupplierParams,
): Promise<Supplier> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireInventoryPermission(tx, { ...params, action: 'write' });
    const existing = await findSupplierById(tx, params.supplierId);
    if (!existing || existing.organizationId !== params.organizationId) {
      throw new NotFoundError('Supplier');
    }
    return setSupplierDeletedAt(tx, params.supplierId);
  });
}
