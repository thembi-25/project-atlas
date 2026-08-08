# Compliance

## Purpose

Compliance captures the record-keeping field-service businesses need for licensing, permitting, and inspection obligations — e.g., "was a permit pulled for this electrical panel upgrade," "was the required checklist override documented and by whom." Compliance is not a separate workflow bolted on top; it is largely the byproduct of Jobs, Tasks, and Documents being modeled with enough rigor (required checklist items, override reasons, immutable audit trail) to serve as defensible records.

## Key attributes

- `compliance_records`: `job_id` (or `asset_id`/`property_id` for non-job compliance like a recurring inspection), `type` (`permit`, `inspection`, `license_verification`, `checklist_override`), `reference_number` (e.g., permit number), `status`, `issued_at`/`expires_at` where applicable, supporting [Document](./documents.md) reference.
- Checklist override reasons captured directly on [Tasks](./tasks.md) (`override_reason`), which double as compliance evidence without a separate record for the common case.

## Relationships

- **Belongs to** one [Organization](./organization.md), typically referencing a [Job](./jobs.md), [Property](./properties.md), or [Asset](./assets.md).
- **Supported by** [Documents](./documents.md) (permit PDFs, inspection reports) and [Audit Events](./audit-events.md) (who did what, when).

## Business rules

1. Compliance is trade/jurisdiction-configurable, not hard-coded: which `job_types` require a `permit`-type Compliance Record, and which fields are mandatory, is Organization/trade configuration (extending the pattern in [Domain Overview](./domain-overview.md#the-trade-agnostic-configuration-pattern)) — Atlas does not hard-code specific state/local licensing rules into core logic.
2. A Job whose Job Type is flagged as `requires_permit` cannot transition to `completed` without an associated `compliance_records` row of type `permit` in a non-`pending` terminal status, or an explicit, audited override — same enforcement pattern as required [Tasks](./tasks.md).
3. Compliance Records are never deleted, only superseded (a renewed license verification creates a new record referencing the old one), preserving a full compliance history for audits/inspections.

## Data requirements

`compliance_records` (`organization_id`, `job_id` nullable, `property_id` nullable, `asset_id` nullable, `type`, `reference_number`, `status`, `issued_at`, `expires_at`, `document_id`, timestamps).

## Permission requirements

Dispatcher/Admin/Owner: full management. Technician: read/write on assigned Jobs' compliance records. Accountant: read-only.

## Related documents

[Compliance PRD](../06-modules/compliance-prd.md) · [Jobs](./jobs.md) · [Tasks](./tasks.md) · [Audit Events](./audit-events.md)
