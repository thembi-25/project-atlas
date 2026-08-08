# Constraints

## Principle

Business rules that can be enforced by the database are enforced by the database, not left to application code alone — this is the same defense-in-depth philosophy as [Tenant Isolation](../07-security/tenant-isolation.md) applied to data integrity generally. Application-layer validation (Zod, see [Request Validation](../05-api/request-validation.md)) exists for good error messages and early rejection; database constraints exist as the non-negotiable backstop.

## Constraint types in use

### `NOT NULL`
Applied to every column representing a required fact, from the first migration that introduces it — never added retroactively as an afterthought once null rows already exist (see [Migrations](./migrations.md) for how a column is safely tightened if truly needed).

### `CHECK`
| Example | Rule |
|---|---|
| `chk_invoices_balance` | `amount_paid <= total` (enforced via a trigger recomputing from `payments`, backed by a check on the computed view, since `amount_paid` itself is derived — see [Invoices](../03-domain/invoices.md)) |
| `chk_documents_attached_to_type` | `attached_to_type IN ('job','property','asset')` |
| `chk_estimate_line_items_quantity` | `quantity > 0` |
| `chk_payments_amount_nonzero` | `amount <> 0` (refunds are negative, captures are positive, never zero) |

### `UNIQUE`
| Example | Rule |
|---|---|
| `uq_organization_memberships_user_org` | One Membership row per (`user_id`, `organization_id`) pair |
| `uq_jobs_org_job_number` | `(organization_id, job_number)` unique |
| `uq_invoices_org_invoice_number` | `(organization_id, invoice_number)` unique |
| `uq_payments_idempotency_key` | `idempotency_key` globally unique |
| `uq_contacts_customer_primary` | Partial unique index: at most one `is_primary = true` Contact per `customer_id` |

### Foreign key constraints
See [Foreign Keys](./foreign-keys.md) for the full `ON DELETE` policy.

### Domain/enum constraints
Status and type columns use Postgres native `ENUM` types (e.g., `job_status`, `invoice_status`, `payment_status`) rather than free-text with an application-level check, so an invalid status value is structurally impossible to insert, not just discouraged. See [Naming Conventions](./naming-conventions.md).

## Enforcing cross-entity business rules via triggers, when a plain constraint can't express them

Some rules from the [Domain Model](../03-domain/domain-overview.md) span multiple rows and need a trigger, not just a `CHECK`:

- **"An Organization must always have at least one Owner Membership."** Enforced by a trigger on `organization_memberships`/`membership_roles` that rejects a deletion or Role change that would leave zero active Owner Memberships for an Organization. See [Organization](../03-domain/organization.md), Business Rules.
- **"A finalized Invoice's line items are immutable."** Enforced by a trigger on `invoice_line_items` that rejects `UPDATE`/`DELETE` when the parent `invoices.status <> 'draft'`. See [Invoices](../03-domain/invoices.md).
- **"`audit_events` is append-only."** Enforced by revoking `UPDATE`/`DELETE` privileges on the table from the application's runtime database role entirely, not just by a trigger — see [Audit Logging](./audit-logging.md).

## Related documents

[Foreign Keys](./foreign-keys.md) · [Request Validation](../05-api/request-validation.md) · [Audit Logging](./audit-logging.md)
