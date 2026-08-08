# Tasks

## Purpose

A Task is a discrete step or checklist/form item within a [Job](./jobs.md) — e.g., "Check refrigerant pressure," "Photograph panel before work," "Customer signature." Tasks operationalize the `checklist_templates`/`form_definitions` configuration entity referenced by a Job's Job Type. See [Domain Overview](./domain-overview.md#the-trade-agnostic-configuration-pattern).

## Key attributes

- `label`, `type` (`checkbox`, `text`, `number`, `photo`, `signature`, `select`).
- `is_required` (inherited from the template by default, can be relaxed only with a documented override reason).
- `order` (display sequence).
- `response_value` (typed per `type`), `completed_by_user_id`, `completed_at`.

## Relationships

- **Belongs to** one [Job](./jobs.md).
- **Instantiated from** a `checklist_template`/`form_definition` item at Job creation (a copy, not a live reference — so editing a template later never rewrites historical Job Tasks).
- **May produce** a [Document](./documents.md) (for `photo`/`signature` type Tasks).

## Business rules

1. Tasks are copied onto the Job at creation time from the Job Type's template, not referenced live — this guarantees a Job's checklist is a permanent record of what was actually required and completed at the time, even if the Organization edits the template afterward.
2. A required Task must be completed (or explicitly overridden with a reason) before the parent Job can transition to `completed` — see [Jobs](./jobs.md), Business Rules.
3. `photo`/`signature` Task types store their captured content as a [Document](./documents.md) and reference it, rather than storing binary data inline in the Task row.
4. Task completion is individually attributable (`completed_by_user_id`, `completed_at`) even when multiple Technicians are assigned to the same Job.

## Data requirements

`checklist_templates` / `form_definitions` (Organization-scoped, extensible from platform defaults, linked to `job_types`), `tasks` (`job_id`, `label`, `type`, `is_required`, `order`, `response_value` (jsonb), `completed_by_user_id`, `completed_at`, `override_reason` nullable).

## Permission requirements

Same as parent [Job](./jobs.md) — a Technician can complete Tasks only on Jobs they're assigned to.

## Related documents

[Jobs PRD](../06-modules/jobs-prd.md) · [Documents](./documents.md) · [Compliance](./compliance.md)
