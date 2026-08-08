# Compliance — PRD

## 1. Purpose

Capture permit, inspection, licensing, and checklist-override evidence tied to Jobs/Assets/Properties, configurable per trade/jurisdiction. See [Compliance](../03-domain/compliance.md).

## 2. Business problem

Licensing boards and insurers periodically require proof that permits were pulled and required steps followed; businesses today reconstruct this from memory or paper files under time pressure during an audit or dispute.

## 3. Goals

- Compliance evidence is captured as a natural byproduct of doing the Job correctly, not a separate burdensome workflow.
- Required-Task overrides are always accompanied by a reason, creating defensible evidence either way.
- Permit/inspection requirements are configurable per Organization/trade, not hard-coded platform logic.

## 4. Non-goals

- Automated integration with municipal permitting systems — out of scope; permit numbers are staff-entered.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md), [Maria (Owner)](../00-overview/user-personas.md) (accountable for compliance posture).

## 6. User stories

As an Owner, I want Jobs that require a permit to be blocked from completion until the permit is recorded, so we never accidentally skip a required step.

## 7. Functional requirements

Configure which `job_types` require which Compliance Record types; record/attach a Compliance Record (with supporting Document) to a Job; override flow with mandatory reason.

## 8. Business rules

Full detail in [Compliance](../03-domain/compliance.md) — notably: Compliance Records are never deleted, only superseded; a `requires_permit` Job Type cannot complete without a non-pending permit record or an audited override.

## 9. State machines

Compliance Record status: `pending → issued/denied` (permit-type); `scheduled → passed/failed` (inspection-type) — type-specific, documented per `type` value.

## 10. Data requirements

`compliance_records` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH /api/v1/compliance-records`, filterable by `job_id`/`property_id`/`asset_id`.

## 12. Permission requirements

Dispatcher/Admin/Owner: full management. Technician: read/write on assigned Jobs' compliance records. Accountant: read-only.

## 13. UI requirements

Compliance section on the Job detail page, showing required records and their status; blocking banner on Job completion when a required record is missing; override modal requiring a typed reason.

## 14. Notifications

Permit/inspection status change notification to the responsible staff member.

## 15. Audit requirements

Every Compliance Record change and every override produces an [Audit Event](../03-domain/audit-events.md) — overrides are flagged as high-sensitivity given their audit purpose.

## 16. Error cases

Completing a `requires_permit` Job without a permit record or override (`422`, per [Jobs](../03-domain/jobs.md) Business Rules); recording a permit number that duplicates an existing record for the same Job (`409`).

## 17. Edge cases

A jurisdiction requires a permit only above a certain job value threshold — modeled as an Organization-configurable rule (e.g., `requires_permit_above_amount` on the Job Type), not a hard platform-wide rule, since thresholds vary by locality and trade.

## 18. Acceptance criteria

**Given** a Job Type flagged `requires_permit`, **when** a Technician attempts to complete the Job without a permit record, **then** completion is blocked with a message identifying exactly what's missing, unless an Admin/Owner-authorized override with reason is recorded.

## 19. Testing requirements

Completion-gating tests per configuration; override-requires-reason tests; Organization-level configuration isolation tests (Organization A's permit rules never apply to Organization B).

## 20. Future extensions

Municipal permitting system integrations (jurisdiction-specific, likely per-region rollout); automated license-expiration tracking for Technicians tied to their `technician_profiles` certifications.
