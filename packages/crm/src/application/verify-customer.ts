import type { DatabaseClient } from '@atlas/database';
import { findCustomerById, type Customer } from '../infrastructure/customers';

/**
 * Cross-module read for other Organization-scoped modules that need to
 * verify a Customer exists and belongs to the caller's Organization before
 * creating a cross-table reference to it — component-architecture.md's
 * module-responsibility table documents `properties` as depending on
 * `crm` (Properties associate with Customers — see
 * docs/03-domain/properties.md). Accepts an already-open transaction from
 * the caller's own `withRequestContext` rather than opening its own,
 * mirroring @atlas/identity's `findActiveMembershipByOrgAndUser`
 * composable-function pattern. Does not itself check Permissions — the
 * caller has already verified its own relevant Permission (e.g.
 * `properties:write`); this is purely an existence + tenant-ownership
 * check so a cross-tenant Customer ID can never reach a foreign-key
 * insert on the caller's side — defense-in-depth alongside the database's
 * own RLS `WITH CHECK` clause for the same relationship (see
 * docs/07-security/tenant-isolation.md: "Do not assume that
 * application-level foreign-key checks are sufficient" applies in the
 * other direction too — RLS alone is not sufficient either).
 */
export async function findCustomerForOrganization(
  tx: DatabaseClient,
  params: { organizationId: string; customerId: string },
): Promise<Customer | undefined> {
  const customer = await findCustomerById(tx, params.customerId);
  if (!customer || customer.organizationId !== params.organizationId) {
    return undefined;
  }
  return customer;
}
