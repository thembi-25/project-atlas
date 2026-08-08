# Seed Data

## Purpose

Seed data is platform-managed reference data required for the application to function correctly out of the box, distinct from tenant-created data. It is version-controlled alongside migrations and applied identically to every environment (Local, Preview, Staging, Production), per [Environment Management](../10-devops/environment-management.md).

## What is seeded

| Table | Seed content | Editable by tenants? |
|---|---|---|
| `roles` | Owner, Admin, Dispatcher, Technician, Accountant, Read Only | No — platform-fixed at launch (see [Roles](../03-domain/roles.md), Future Extensions) |
| `permissions` | The full `resource:action` catalog | No |
| `role_permissions` | The Role-to-Permission mapping table in [Roles](../03-domain/roles.md#role-to-module-access-summary) | No |
| `trade_types` | Plumbing, HVAC, Electrical | No (platform-defined; more trades added by platform admins as the roadmap expands — see [Product Scope](../01-product/product-scope.md)) |
| `asset_types` (platform defaults) | Common equipment per trade (e.g., "Tankless Water Heater," "Split System Condenser," "200A Panel") | Yes — Organizations can add their own in addition to platform defaults |
| `job_types` (platform defaults) | Common job categories per trade (e.g., "Drain Cleaning," "AC Repair," "Panel Upgrade") | Yes — same extension pattern |
| `service_categories` (platform defaults) | Repair, Installation, Maintenance, Inspection | Yes |
| `checklist_templates` (platform defaults) | A baseline diagnostic checklist per default Job Type | Yes — Organizations can customize |
| `manufacturers` (platform-seeded subset) | Well-known plumbing/HVAC/electrical equipment manufacturers | Organizations can add unlisted ones (see [Manufacturers](../03-domain/manufacturers.md)) |

## Seeding mechanism

Seed data is applied via idempotent SQL migrations (using `INSERT ... ON CONFLICT DO NOTHING`/`DO UPDATE` keyed on stable, hand-assigned UUIDs or natural unique keys) — never via an ad hoc script run manually against Production, so seed data ships through the same reviewed, auditable migration pipeline as schema changes. See [Migrations](./migrations.md).

## Platform-fixed vs. Organization-extensible

The distinction matters for RLS and application logic: platform-fixed tables (`roles`, `permissions`, `role_permissions`, `trade_types`) have no `organization_id` and are read-only to tenant application code entirely; Organization-extensible tables (`asset_types`, `job_types`, `service_categories`, `checklist_templates`) have a nullable `organization_id` — `NULL` meaning "platform default, visible to all Organizations" and a set value meaning "this Organization's custom addition," with application queries always returning the union of both.

## Test/development seed data

Separate, clearly-marked fixture data (sample Organizations, Customers, Properties, Jobs) for Local and Preview environments only, never applied to Staging or Production — see [Local Development](../10-devops/local-development.md), [Seed data section].

## Related documents

[Migrations](./migrations.md) · [Roles](../03-domain/roles.md) · [Domain Overview](../03-domain/domain-overview.md) · [Environment Management](../10-devops/environment-management.md)
