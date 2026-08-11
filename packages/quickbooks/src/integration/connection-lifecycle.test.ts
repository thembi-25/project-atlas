import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema, withServiceContext } from '@atlas/database';
import { acceptInvitation, createOrganization, inviteMember } from '@atlas/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectQuickBooks, ForbiddenError, getQuickBooksSyncStatus, NotFoundError } from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * integrations-prd.md §12/§19: Admin/Owner-only permission gating, and
 * disconnect/sync-status behavior against a directly-seeded
 * `integration_connections` row (not a real OAuth exchange — the actual
 * Intuit token exchange (`@atlas/integrations`'s
 * `exchangeQuickBooksAuthorizationCode`) needs a real, registered
 * QuickBooks app and network egress this sandbox doesn't have — see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known Limitations).
 * The fixture's `refresh_token` is left `null` so `disconnectQuickBooks`'s
 * best-effort revoke call is skipped entirely, keeping this suite free of
 * any real outbound HTTP call.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const owner = { id: randomUUID(), email: `qb-owner-${suffix}@example.test`, fullName: 'Owner' };
const technician = { id: randomUUID(), email: `qb-tech-${suffix}@example.test`, fullName: 'Technician' };

let organizationId: string;
let connectionId: string;

const capturedTokens: Record<string, string> = {};
const capturingNotifier = {
  sendInvitation: (params: { invitedEmail: string; invitationToken: string }) => {
    capturedTokens[params.invitedEmail] = params.invitationToken;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const org = await createOrganization(db, { name: `QuickBooks Org ${suffix}`, tradeTypeIds: [], owner });
  organizationId = org.organizationId;

  await inviteMember(
    db,
    { organizationId, actorUserId: owner.id, invitedEmail: technician.email, roleName: 'technician' },
    capturingNotifier,
  );
  const token = capturedTokens[technician.email];
  expect(token).toBeDefined();
  await acceptInvitation(db, { token: token!, invitee: technician });

  await withServiceContext(db, async (tx) => {
    const [connection] = await tx
      .insert(schema.integrationConnections)
      .values({
        organizationId,
        provider: 'quickbooks',
        status: 'connected',
        accessToken: 'fake-access-token',
        refreshToken: null,
        realmId: `realm-${suffix}`,
        connectedByUserId: owner.id,
        connectedAt: new Date(),
      })
      .returning();
    connectionId = connection!.id;
  });
});

afterAll(async () => {
  await withServiceContext(db, (tx) =>
    tx.delete(schema.integrationConnections).where(eq(schema.integrationConnections.id, connectionId)),
  );
});

describe('QuickBooks connection permission gating', () => {
  it('denies a Technician read access to sync status', async () => {
    await expect(
      getQuickBooksSyncStatus(db, { organizationId, actorUserId: technician.id, limit: 10 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('denies a Technician disconnect access', async () => {
    await expect(disconnectQuickBooks(db, { organizationId, actorUserId: technician.id })).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe('QuickBooks disconnect/sync-status', () => {
  it('lets Owner read the connection and its (empty) sync records', async () => {
    const result = await getQuickBooksSyncStatus(db, { organizationId, actorUserId: owner.id, limit: 10 });
    expect(result.connection?.status).toBe('connected');
    expect(result.syncRecords.rows).toEqual([]);
  });

  it('lets Owner disconnect, and a second disconnect attempt 404s', async () => {
    const disconnected = await disconnectQuickBooks(db, { organizationId, actorUserId: owner.id });
    expect(disconnected.status).toBe('disconnected');
    expect(disconnected.accessToken).toBeNull();

    await expect(disconnectQuickBooks(db, { organizationId, actorUserId: owner.id })).rejects.toThrow(
      NotFoundError,
    );
  });
});
