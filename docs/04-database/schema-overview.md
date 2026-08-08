# Schema Overview

## Purpose

This document lists the launch-scope tables grouped by module, with purpose and key columns, as the bridge between the [Domain Model](../03-domain/domain-overview.md) and actual implementation. It intentionally does not repeat full DDL (that lives in the Drizzle schema source once implementation begins) — it is the reviewable, human-readable contract for what tables must exist and why.

## `identity` schema

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Platform-wide user identity, mirrors Supabase `auth.users` | `id`, `email`, `full_name`, `phone` |
| `organization_memberships` | Join of User ↔ Organization, carries status | `id`, `user_id`, `organization_id`, `status` |
| `membership_roles` | Join of Membership ↔ Role (many-to-many) | `membership_id`, `role_id` |
| `roles` | Platform-defined Role catalog | `id`, `name` |
| `permissions` | Platform-defined Permission catalog | `id`, `resource`, `action` |
| `role_permissions` | Role ↔ Permission mapping (seed data) | `role_id`, `permission_id` |

See [Users](../03-domain/users.md), [Roles](../03-domain/roles.md), [Permissions](../03-domain/permissions.md).

## `org` schema

| Table | Purpose | Key columns |
|---|---|---|
| `organizations` | Tenant root | `id`, `name`, `trade_types` (array ref), `timezone` |
| `teams` | Optional User groupings | `id`, `organization_id`, `name` |
| `team_members` | Join of Team ↔ User | `team_id`, `user_id` |

See [Organization](../03-domain/organization.md).

## `crm` schema

| Table | Purpose | Key columns |
|---|---|---|
| `customers` | Billing party | `id`, `organization_id`, `type`, `display_name` |
| `contacts` | Individuals tied to a Customer | `id`, `customer_id`, `name`, `is_primary`, `portal_access_enabled` |

See [Customers](../03-domain/customers.md), [Contacts](../03-domain/contacts.md).

## `properties` schema

| Table | Purpose | Key columns |
|---|---|---|
| `properties` | Physical location, persistent | `id`, `organization_id`, address fields, `property_type` |
| `property_customer_associations` | Property ↔ Customer over time | `property_id`, `customer_id`, `effective_from`, `effective_to` |
| `buildings` | Structure on a Property | `id`, `property_id`, `name` |
| `rooms` | Space within a Building | `id`, `building_id`, `name` |
| `asset_types` | Configurable equipment categories | `id`, `organization_id`, `trade_type_id`, `name` |
| `assets` | Installed equipment | `id`, `property_id`, `building_id`, `room_id`, `asset_type_id`, `manufacturer_id`, `serial_number` |

See [Properties](../03-domain/properties.md), [Buildings](../03-domain/buildings.md), [Rooms](../03-domain/rooms.md), [Assets](../03-domain/assets.md).

## `jobs` schema

| Table | Purpose | Key columns |
|---|---|---|
| `trade_types` | Platform trade catalog | `id`, `name` |
| `job_types` | Configurable job categories | `id`, `organization_id`, `trade_type_id`, `name`, `default_duration_minutes` |
| `service_categories` | Pricing/reporting grouping | `id`, `organization_id`, `name` |
| `checklist_templates` | Job Type default checklist | `id`, `organization_id`, `job_type_id` |
| `checklist_template_items` | Individual template steps | `id`, `checklist_template_id`, `label`, `type`, `is_required`, `order` |
| `jobs` | Core work unit | `id`, `organization_id`, `job_number`, `job_type_id`, `status`, `customer_id`, `property_id` |
| `job_assets` | Job ↔ Asset join | `job_id`, `asset_id` |
| `job_assignments` | Job ↔ Technician join | `job_id`, `user_id` |
| `tasks` | Job checklist items (copied from template) | `id`, `job_id`, `label`, `type`, `is_required`, `response_value`, `completed_at` |
| `job_status_history` | Status transition log | `id`, `job_id`, `from_status`, `to_status`, `changed_by`, `changed_at` |
| `schedule_events` | Scheduling record | `id`, `job_id`, `scheduled_start`, `scheduled_end` |
| `schedule_event_assignments` | Schedule ↔ Technician join | `schedule_event_id`, `user_id` |
| `dispatch_events` | Dispatch lifecycle timestamps | `id`, `job_id`, `dispatched_at`, `acknowledged_at`, `en_route_at`, `arrived_at` |

See [Jobs](../03-domain/jobs.md), [Tasks](../03-domain/tasks.md), [Scheduling](../03-domain/scheduling.md), [Dispatch](../03-domain/dispatch.md).

## `financials` schema

| Table | Purpose | Key columns |
|---|---|---|
| `estimates` | Priced proposal | `id`, `organization_id`, `job_id`, `status`, `total` |
| `estimate_line_items` | Estimate detail lines | `id`, `estimate_id`, `description`, `quantity`, `unit_price` |
| `invoices` | Finalized bill (immutable once finalized) | `id`, `organization_id`, `job_id`, `estimate_id`, `invoice_number`, `status`, `total` |
| `invoice_line_items` | Invoice detail lines | `id`, `invoice_id`, `description`, `quantity`, `unit_price` |
| `credit_notes` | Adjustment to a finalized Invoice | `id`, `invoice_id`, `reason`, `amount` |
| `payments` | Recorded fund transfer | `id`, `organization_id`, `invoice_id`, `amount`, `status`, `idempotency_key` |

See [Estimates](../03-domain/estimates.md), [Invoices](../03-domain/invoices.md), [Payments](../03-domain/payments.md).

## `inventory` schema

| Table | Purpose | Key columns |
|---|---|---|
| `inventory_items` | Trackable part/material | `id`, `organization_id`, `sku`, `unit_cost` |
| `inventory_locations` | Warehouse/truck locations | `id`, `organization_id`, `type`, `technician_user_id` |
| `stock_movements` | Append-only quantity ledger | `id`, `inventory_item_id`, `location_id`, `quantity_delta`, `reason` |
| `job_parts` | Job ↔ Inventory Item consumption | `id`, `job_id`, `inventory_item_id`, `quantity`, `unit_cost_at_time` |
| `suppliers` | Vendor reference | `id`, `organization_id`, `name` |
| `purchase_orders` | Basic manual PO | `id`, `organization_id`, `supplier_id`, `status` |

See [Inventory](../03-domain/inventory.md), [Suppliers](../03-domain/suppliers.md).

## `reference` schema

| Table | Purpose | Key columns |
|---|---|---|
| `manufacturers` | Platform-shared equipment makers | `id`, `name`, `is_platform_verified` |
| `warranties` | Coverage record | `id`, `asset_id`, `warranty_type`, `coverage_end` |
| `compliance_records` | Permit/inspection/override evidence | `id`, `organization_id`, `job_id`, `type`, `status` |

See [Manufacturers](../03-domain/manufacturers.md), [Warranties](../03-domain/warranties.md), [Compliance](../03-domain/compliance.md).

## `documents` / `notifications` / `platform` schemas

| Table | Purpose | Key columns |
|---|---|---|
| `documents` | File attachment metadata | `id`, `organization_id`, `attached_to_type`, `attached_to_id`, `file_url` |
| `notifications` | Sent notification log | `id`, `organization_id`, `recipient_type`, `channel`, `status` |
| `notification_preferences` | Per-User/Contact preferences | `id`, `owner_type`, `owner_id`, `event_type`, `channel`, `enabled` |
| `audit_events` | Immutable audit trail | `id`, `organization_id`, `actor_user_id`, `entity_type`, `entity_id`, `diff` |
| `domain_events` | Internal cross-module event log | `id`, `organization_id`, `type`, `payload` |

See [Documents](../03-domain/documents.md), [Audit Events](../03-domain/audit-events.md).

## Related documents

[Entity Relationships](./entity-relationships.md) · [Database Architecture](./database-architecture.md) · [Domain Overview](../03-domain/domain-overview.md)
