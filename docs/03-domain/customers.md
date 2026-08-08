# Customers

## Purpose

A Customer is the party an Organization performs work for and bills — a residential household or a commercial account (e.g., a property management company). Customers are owned by exactly one Organization. See [Terminology](../00-overview/terminology.md).

## Key attributes

- Type: `residential` or `commercial`.
- Display name (individual name for residential; company name for commercial).
- Billing address (may differ from any Property's service address).
- Primary phone/email (for residential Customers without a separate Contact record).
- Tags/notes (free-form, staff-facing).
- Customer Portal access flag (whether this Customer/its Contacts can log into the [Customer Portal](../06-modules/customer-portal-prd.md)).

## Relationships

- **Belongs to** one [Organization](./organization.md).
- **Has many** [Contacts](./contacts.md) (a commercial Customer typically has several; a residential Customer often has exactly one, sometimes co-mapped to the Customer record itself for convenience).
- **Has many** [Properties](./properties.md) — a commercial property manager Customer may have dozens of Properties; a residential Customer typically has one.
- **Has many** [Jobs](./jobs.md), [Estimates](./estimates.md), [Invoices](./invoices.md).

## Business rules

1. A Customer is scoped to a single Organization; the same real-world person/company known to two different Organizations is modeled as two distinct Customer records — Atlas does not share Customer identity across tenants (this would violate [Tenant Isolation](../07-security/tenant-isolation.md)).
2. A residential Customer's primary phone/email can be used directly for notifications when no separate Contact exists, but internally is still represented via an implicit primary Contact record to keep the notification/portal-access model uniform — see [Contacts](./contacts.md).
3. Deleting a Customer is a soft delete; a Customer with any non-deleted Job, Estimate, or Invoice cannot be hard-deleted, ever, due to financial/audit retention requirements. See [Soft Deletion](../04-database/soft-deletion.md).
4. A Property can be associated with more than one Customer over its lifetime (e.g., the property is sold); the Property record and its Asset history persist independent of which Customer currently owns/manages it — see [Properties](./properties.md), Business Rules.

## Data requirements

`customers` table with `organization_id`, `type`, `display_name`, `billing_address`, `portal_access_enabled`, `deleted_at`, timestamps. See [Schema Overview](../04-database/schema-overview.md).

## Permission requirements

Dispatcher, Accountant, Admin, Owner: read/write. Technician: read-only, scoped to Customers tied to their assigned Jobs. See [Permissions](./permissions.md).

## Related documents

[CRM PRD](../06-modules/crm-prd.md) · [Customers PRD](../06-modules/customers-prd.md) · [Contacts](./contacts.md) · [Properties](./properties.md)
