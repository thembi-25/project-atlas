/**
 * docs/03-domain/permissions.md/docs/03-domain/roles.md: Suppliers and
 * Purchase Orders share the same combined `inventory` resource as
 * Inventory Items — there is no separate `suppliers` Permission resource
 * in the documented catalog (confirmed against the already-applied
 * Sprint 1 seed and roles.md's single combined "Inventory" row) — see
 * docs/13-roadmap/sprint-6.md, "Scope decisions." Re-exported here rather
 * than duplicated so both packages share one implementation.
 */
export { requireInventoryPermission } from '@atlas/inventory';
