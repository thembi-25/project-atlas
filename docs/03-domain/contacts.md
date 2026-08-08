# Contacts

## Purpose

A Contact is an individual person associated with a [Customer](./customers.md) — e.g., a property manager's on-site representative, a homeowner's spouse, an accounts-payable clerk at a commercial account. Contacts are how Atlas models "who do we actually talk to," separate from the billing entity itself.

## Key attributes

- Name, phone, email, role/title (e.g., "Property Manager", "Tenant", "Homeowner").
- `is_primary` flag (the default Contact used for notifications when a Job doesn't specify otherwise).
- `portal_access_enabled` flag and linked authentication identity (a Contact with portal access is linked to a login, distinct from a staff User — see [Customer Portal PRD](../06-modules/customer-portal-prd.md)).
- Per-Contact notification preferences (channel, event types) — see [Notifications PRD](../06-modules/notifications-prd.md).

## Relationships

- **Belongs to** one [Customer](./customers.md).
- **Referenced by** [Jobs](./jobs.md) (a Job can specify which Contact to coordinate with on-site, distinct from the Customer's primary Contact).
- **Referenced by** [Estimates](./estimates.md)/[Invoices](./invoices.md) as the recipient when it differs from the Customer's default billing Contact.

## Business rules

1. Every Customer has at least one Contact; for a residential Customer created without explicitly adding a Contact, the system creates an implicit primary Contact from the Customer's own name/phone/email at creation time, keeping downstream notification/portal logic uniform regardless of Customer type.
2. Exactly one Contact per Customer may be `is_primary` at a time; setting a new primary Contact unsets the previous one (enforced by a partial unique constraint — see [Constraints](../04-database/constraints.md)).
3. Portal access is granted per Contact, not per Customer — a commercial Customer can have some Contacts with portal access and others without.
4. Removing portal access from a Contact does not delete the Contact record or its historical association with past Jobs/Estimates/Invoices.

## Data requirements

`contacts` table: `customer_id`, `name`, `phone`, `email`, `role_title`, `is_primary`, `portal_access_enabled`, `portal_user_id` (nullable, links to the portal authentication identity), timestamps.

## Permission requirements

Same as [Customers](./customers.md) — Contacts inherit visibility from their parent Customer; there is no independent Contact-level permission.

## Related documents

[CRM PRD](../06-modules/crm-prd.md) · [Customer Portal PRD](../06-modules/customer-portal-prd.md) · [Notifications PRD](../06-modules/notifications-prd.md)
