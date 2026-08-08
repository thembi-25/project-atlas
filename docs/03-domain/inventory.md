# Inventory

## Purpose

Inventory tracks the parts and materials an Organization stocks (in a warehouse and/or on Technicians' trucks) and consumes on [Jobs](./jobs.md). It exists to keep parts cost tied to Job cost accurately, and to give staff visibility into stock levels without manual counts.

## Key attributes

- `inventory_items`: SKU, description, unit cost, default sell price, `asset_type_id` (optional link — a part that's commonly used for a specific Asset Type).
- `inventory_locations`: `warehouse` or `truck` (linked to a Technician via `technician_profiles`), per-location quantity on hand.
- `stock_movements`: append-only ledger of every quantity change (`received`, `consumed_on_job`, `transferred`, `adjusted`), never a direct edit to the quantity-on-hand field.
- `job_parts`: the join between a Job (or its Estimate/Invoice line item) and the Inventory Item consumed, with quantity and cost-at-time-of-use captured (so later cost changes don't retroactively alter historical Job costing).

## Relationships

- **Belongs to** one [Organization](./organization.md).
- **Consumed by** [Jobs](./jobs.md) via `job_parts`, which typically also produces a line item on the Job's [Estimate](./estimates.md)/[Invoice](./invoices.md).
- **Sourced from** [Suppliers](./suppliers.md) (purchase order reference, launch-scope basic; full Marketplace-driven sourcing is a future extension — see [Marketplace](./marketplace.md)).

## Business rules

1. Quantity on hand per location is always derived by summing `stock_movements`, never stored as an independently editable field — this guarantees the audit trail (`stock_movements`) and the displayed quantity can never drift apart.
2. Adding a part to a Job creates a `stock_movements` row (`consumed_on_job`, negative quantity) at the Technician's assigned truck location; if that location lacks sufficient stock, the system warns but does not hard-block (a Technician may still perform the work and true up inventory later) — consistent with the field-context-first principle in [Product Principles](../00-overview/product-principles.md).
3. `job_parts` captures `unit_cost_at_time` independently of the Inventory Item's current unit cost, so historical Job profitability reporting is never silently rewritten by a later cost update.
4. Low-stock alerting is threshold-based per Inventory Item per location, configurable per Organization.

## Data requirements

`inventory_items`, `inventory_locations`, `stock_movements`, `job_parts` — all `organization_id`-scoped. See [Schema Overview](../04-database/schema-overview.md).

## API requirements

CRUD for Inventory Items, stock adjustment endpoints (always creating a `stock_movements` row, never a direct UPDATE to a quantity field), and a Job-parts-consumption endpoint. See [Inventory PRD](../06-modules/inventory-prd.md).

## Permission requirements

Technician: consume parts on assigned Jobs (write-restricted to `job_parts` creation, not Inventory Item master data). Dispatcher/Admin/Owner: full management. Accountant: read-only (for costing reports).

## Related documents

[Inventory PRD](../06-modules/inventory-prd.md) · [Suppliers](./suppliers.md) · [Jobs](./jobs.md) · [Marketplace](./marketplace.md)
