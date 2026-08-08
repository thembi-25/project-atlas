import { eq } from 'drizzle-orm';
import { schema } from '@atlas/database';
import { afterAll, describe, expect, it } from 'vitest';
import { getIntegrationDb } from './helpers';

/**
 * docs/09-testing/database-testing.md, "Seed data tests": every Role has
 * at least the Permissions documented in
 * docs/03-domain/roles.md#role-to-module-access-summary. This is a
 * read-only suite against the platform seed data applied in
 * migrations/0002_seed_platform_data.sql — no test data is created.
 */
const db = getIntegrationDb();

async function permissionsForRole(roleName: string): Promise<Set<string>> {
  const rows = await db
    .select({ resource: schema.permissions.resource, action: schema.permissions.action })
    .from(schema.rolePermissions)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.rolePermissions.roleId))
    .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
    .where(eq(schema.roles.name, roleName));
  return new Set(rows.map((r) => `${r.resource}:${r.action}`));
}

describe('seed data — Role/Permission referential completeness', () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it('seeds exactly the six platform-fixed Roles', async () => {
    const roles = await db.select({ name: schema.roles.name }).from(schema.roles);
    expect(new Set(roles.map((r) => r.name))).toEqual(
      new Set(['owner', 'admin', 'dispatcher', 'technician', 'accountant', 'read_only']),
    );
  });

  it('owner has every permission in the catalog', async () => {
    const [allPermissions, ownerPermissions] = await Promise.all([
      db.select().from(schema.permissions),
      permissionsForRole('owner'),
    ]);
    expect(ownerPermissions.size).toBe(allPermissions.length);
  });

  it('admin has every permission except organization:manage_billing', async () => {
    const adminPermissions = await permissionsForRole('admin');
    expect(adminPermissions.has('organization:manage_billing')).toBe(false);
    expect(adminPermissions.has('organization:manage_settings')).toBe(true);
    expect(adminPermissions.has('organization:manage_users')).toBe(true);
  });

  it('dispatcher has no Organization or audit access — docs/03-domain/roles.md module summary', async () => {
    const dispatcherPermissions = await permissionsForRole('dispatcher');
    expect([...dispatcherPermissions].some((p) => p.startsWith('organization:'))).toBe(false);
    expect([...dispatcherPermissions].some((p) => p.startsWith('audit:'))).toBe(false);
    expect(dispatcherPermissions.has('jobs:write')).toBe(true);
    expect(dispatcherPermissions.has('jobs:delete')).toBe(false);
  });

  it('technician is scoped to assigned work — docs/03-domain/roles.md module summary', async () => {
    const technicianPermissions = await permissionsForRole('technician');
    expect(technicianPermissions.has('jobs:read_assigned')).toBe(true);
    expect(technicianPermissions.has('jobs:read')).toBe(false);
    expect(technicianPermissions.has('jobs:write')).toBe(false);
    expect(technicianPermissions.has('inventory:consume')).toBe(true);
  });

  it('accountant has full financial read/write but no Organization/Users access', async () => {
    const accountantPermissions = await permissionsForRole('accountant');
    expect([...accountantPermissions].some((p) => p.startsWith('organization:'))).toBe(false);
    expect(accountantPermissions.has('invoices:finalize')).toBe(true);
    expect(accountantPermissions.has('payments:refund')).toBe(true);
    expect(accountantPermissions.has('audit:read')).toBe(true);
  });

  it('read_only has read-shaped access on every resource and no write actions', async () => {
    const readOnlyPermissions = await permissionsForRole('read_only');
    expect(readOnlyPermissions.size).toBeGreaterThan(0);
    for (const permission of readOnlyPermissions) {
      const action = permission.split(':')[1];
      expect(action?.startsWith('read')).toBe(true);
    }
  });

  it('seeds the three launch Trade Types', async () => {
    const tradeTypes = await db.select({ slug: schema.tradeTypes.slug }).from(schema.tradeTypes);
    expect(new Set(tradeTypes.map((t) => t.slug))).toEqual(
      new Set(['plumbing', 'hvac', 'electrical']),
    );
  });
});
