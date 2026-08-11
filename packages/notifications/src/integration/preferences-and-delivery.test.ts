import { randomUUID } from 'node:crypto';
import { createOrganization } from '@atlas/identity';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  listMyNotifications,
  listNotificationPreferences,
  sendNotification,
  updateNotificationPreference,
} from '../index';
import { getIntegrationDb, uniqueSuffix } from './helpers';

/**
 * notifications-prd.md §19: "Preference-respecting-delivery tests" and
 * tenant-isolation coverage, matching every prior sprint's integration
 * suite structure. `sendNotification`'s provider call
 * (`@atlas/integrations`'s `sendEmail`/`sendSms`) is not mocked — it's
 * exercised for real, and in this sandbox (no `RESEND_API_KEY`/
 * `TWILIO_ACCOUNT_SID` configured) fails with a clear, caught error that
 * `sendNotification` records as a `failed` notification row rather than
 * throwing — see docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md for why
 * a genuine "delivered" outcome can't be exercised here.
 */
const db = getIntegrationDb();
const suffix = uniqueSuffix();

const ownerA = { id: randomUUID(), email: `notif-owner-a-${suffix}@example.test`, fullName: 'Owner A' };
const ownerB = { id: randomUUID(), email: `notif-owner-b-${suffix}@example.test`, fullName: 'Owner B' };

let organizationAId: string;
let organizationBId: string;

beforeAll(async () => {
  const orgA = await createOrganization(db, { name: `Notif Org A ${suffix}`, tradeTypeIds: [], owner: ownerA });
  organizationAId = orgA.organizationId;
  const orgB = await createOrganization(db, { name: `Notif Org B ${suffix}`, tradeTypeIds: [], owner: ownerB });
  organizationBId = orgB.organizationId;
});

describe('notification preferences', () => {
  it('defaults to enabled when no preference row exists, and can be disabled', async () => {
    const before = await listNotificationPreferences(db, { organizationId: organizationAId, actorUserId: ownerA.id });
    expect(before.find((p) => p.eventType === 'job.completed' && p.channel === 'email')).toBeUndefined();

    const updated = await updateNotificationPreference(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      eventType: 'job.completed',
      channel: 'email',
      enabled: false,
    });
    expect(updated.enabled).toBe(false);

    const after = await listNotificationPreferences(db, { organizationId: organizationAId, actorUserId: ownerA.id });
    const row = after.find((p) => p.eventType === 'job.completed' && p.channel === 'email');
    expect(row?.enabled).toBe(false);
  });

  it('is tenant-isolated: Organization B cannot see Organization A preferences via its own list call', async () => {
    await updateNotificationPreference(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      eventType: 'invoice.finalized',
      channel: 'sms',
      enabled: false,
    });

    const orgBPreferences = await listNotificationPreferences(db, {
      organizationId: organizationBId,
      actorUserId: ownerB.id,
    });
    expect(orgBPreferences.find((p) => p.eventType === 'invoice.finalized')).toBeUndefined();
  });
});

describe('sendNotification', () => {
  it('skips delivery (no notification row, no provider call) when the preference is disabled', async () => {
    await updateNotificationPreference(db, {
      organizationId: organizationAId,
      actorUserId: ownerA.id,
      eventType: 'job.completed',
      channel: 'email',
      enabled: false,
    });

    const result = await sendNotification(db, {
      organizationId: organizationAId,
      event: { type: 'job.completed', jobNumber: '1001' },
      channel: 'email',
      recipient: { type: 'user', userId: ownerA.id },
    });

    expect(result).toEqual({ outcome: 'skipped', reason: 'preference_disabled' });

    const { rows } = await listMyNotifications(db, { organizationId: organizationAId, actorUserId: ownerA.id, limit: 10 });
    expect(rows.find((n) => n.eventType === 'job.completed')).toBeUndefined();
  });

  it('attempts delivery when enabled (default), recording a failed notification since no provider credentials exist in this environment', async () => {
    const result = await sendNotification(db, {
      organizationId: organizationAId,
      event: { type: 'estimate.approved', estimateNumber: '1', jobNumber: '1001' },
      channel: 'email',
      recipient: { type: 'user', userId: ownerA.id },
    });

    expect(result.outcome).toBe('failed');
    if (result.outcome === 'failed') {
      expect(result.notification.status).toBe('failed');
      expect(result.notification.eventType).toBe('estimate.approved');
    }
  });
});
