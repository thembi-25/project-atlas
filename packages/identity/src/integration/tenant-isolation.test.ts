import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withRequestContext, withServiceContext } from '@atlas/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createOrganization,
  inviteMember,
  listMembershipsForOrganization,
  NotFoundError,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * docs/13-roadmap/sprint-1.md exit criteria: "Two separate Organizations
 * can be created by two different Owners... a Technician in Organization
 * A cannot see anything from Organization B, and cannot access
 * Owner-only settings within their own Organization." See also
 * docs/09-testing/integration-testing.md and
 * docs/04-database/multi-tenancy.md's testing requirement.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = { id: randomUUID(), email: `owner-a-${suffix}@example.test`, fullName: 'Owner A' };
const ownerB = { id: randomUUID(), email: `owner-b-${suffix}@example.test`, fullName: 'Owner B' };

let organizationAId: string;
let organizationBId: string;

const noopNotifier = { sendInvitation: () => Promise.resolve() };

beforeAll(async () => {
  const orgA = await createOrganization(db, {
    name: `Org A ${suffix}`,
    tradeTypeIds: [],
    owner: ownerA,
  });
  organizationAId = orgA.organizationId;

  const orgB = await createOrganization(db, {
    name: `Org B ${suffix}`,
    tradeTypeIds: [],
    owner: ownerB,
  });
  organizationBId = orgB.organizationId;
});

afterAll(async () => {
  await withServiceContext(db, async (tx) => {
    for (const organizationId of [organizationAId, organizationBId]) {
      const memberships = await tx
        .select({ id: schema.organizationMemberships.id })
        .from(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, organizationId));
      for (const m of memberships) {
        await tx
          .delete(schema.membershipRoles)
          .where(eq(schema.membershipRoles.membershipId, m.id));
      }
      await tx
        .delete(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, organizationId));
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
    }
    await tx.delete(schema.users).where(eq(schema.users.id, ownerA.id));
    await tx.delete(schema.users).where(eq(schema.users.id, ownerB.id));
  });
  await db.$client.end();
});

describe('cross-tenant isolation', () => {
  it('a User in Organization B sees zero Memberships when querying Organization A', async () => {
    const membershipsAsSeenByOwnerB = await withRequestContext(db, ownerB.id, (tx) =>
      listMembershipsForOrganization(tx, organizationAId),
    );
    expect(membershipsAsSeenByOwnerB).toHaveLength(0);
  });

  it('a User in Organization A sees zero Memberships when querying Organization B', async () => {
    const membershipsAsSeenByOwnerA = await withRequestContext(db, ownerA.id, (tx) =>
      listMembershipsForOrganization(tx, organizationBId),
    );
    expect(membershipsAsSeenByOwnerA).toHaveLength(0);
  });

  it('Owner B cannot invite a Member into Organization A (surfaces as not_found, never forbidden)', async () => {
    await expect(
      inviteMember(
        db,
        {
          organizationId: organizationAId,
          actorUserId: ownerB.id,
          invitedEmail: `intruder-${suffix}@example.test`,
          roleName: 'technician',
        },
        noopNotifier,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('FORCE ROW LEVEL SECURITY holds: a direct select under an unrelated actor context returns zero rows', async () => {
    const rows = await withRequestContext(db, randomUUID(), (tx) =>
      tx
        .select()
        .from(schema.organizationMemberships)
        .where(eq(schema.organizationMemberships.organizationId, organizationAId)),
    );
    expect(rows).toHaveLength(0);
  });
});
