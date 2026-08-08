# Soft Deletion

## Principle

Entities where accidental or premature loss would be costly — operationally or for audit/compliance reasons — use soft deletion (`deleted_at timestamptz NULL`) instead of `DELETE`. Entities that are either already immutable/append-only or trivially non-destructive to lose do not need it. See [Domain Overview](../03-domain/domain-overview.md), cross-cutting rule 3.

## Tables using soft deletion

`customers`, `contacts`, `properties`, `buildings`, `rooms`, `assets`, `jobs`, `estimates`, `inventory_items`, `suppliers`, `documents` (metadata row; the underlying Storage file is handled per [Documents](../03-domain/documents.md)).

## Tables explicitly NOT using soft deletion

| Table | Why not | Instead |
|---|---|---|
| `invoices` | A "deleted" Invoice is a compliance red flag, not a normal state | `status = 'void'` — see [Invoices](../03-domain/invoices.md) |
| `payments` | Append-only money-movement ledger; nothing is ever removed | Refunds are new, linked negative records — see [Payments](../03-domain/payments.md) |
| `audit_events` | Must never be deletable by design | N/A — write-once, no delete path exists at all |
| `job_status_history`, `stock_movements`, `dispatch_events` | Append-only history logs | N/A |
| `role_permissions`, `permissions`, `roles` | Platform-managed seed data, not tenant data | N/A |

## Behavior rules

1. All standard read queries (list/get endpoints) filter `deleted_at IS NULL` by default; a soft-deleted row is only returned via an explicit "include deleted" admin/audit path with its own Permission check.
2. Soft-deleting a parent is blocked if it has non-deleted children with a `RESTRICT` relationship (see [Foreign Keys](./foreign-keys.md)) — e.g., a Property with active Jobs cannot be soft-deleted until those Jobs are resolved or explicitly reassigned/cancelled.
3. Soft-deleting an entity does not soft-delete its historical references elsewhere — a soft-deleted Customer's past Jobs/Invoices remain fully intact and readable, since financial/audit history must survive.
4. Restoring a soft-deleted entity (`deleted_at` set back to `NULL`) is a supported, audited operation (Admin/Owner only), not a one-way door — see [Audit Events](../03-domain/audit-events.md).
5. Soft-deleted rows still count toward `UNIQUE` constraints only where that's the desired behavior (e.g., a soft-deleted Customer's email should not block a new Customer using the same email) — unique constraints on soft-deletable tables are partial indexes scoped to `WHERE deleted_at IS NULL` where this distinction matters.

## Retention and hard deletion

Hard deletion (physically removing a soft-deleted row) is not performed by ordinary application code. Where a genuine hard-delete/purge is required (e.g., a GDPR-style data deletion request, or routine purge of very old soft-deleted rows per a documented retention policy), it is a deliberate, logged administrative operation — see [Data Protection](../07-security/data-protection.md) and [Backups](../10-devops/backups.md).

## Related documents

[Constraints](./constraints.md) · [Audit Logging](./audit-logging.md) · [Data Protection](../07-security/data-protection.md)
