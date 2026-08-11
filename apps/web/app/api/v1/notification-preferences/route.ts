import { z } from 'zod';
import {
  isNotificationChannel,
  isNotificationEventType,
  listNotificationPreferences,
  updateNotificationPreference,
} from '@atlas/notifications';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeNotificationPreference } from '@/lib/notifications-serializers';

/** GET /api/v1/notification-preferences — notifications-prd.md §11. Self-scoped: every row belongs to the requesting actor (User or Portal Contact). */
export const GET = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }

  const preferences = await listNotificationPreferences(getDb(), {
    organizationId,
    actorUserId: actor.id,
  });

  return { data: preferences.map(serializeNotificationPreference) };
});

/** PATCH /api/v1/notification-preferences — upserts one (event_type, channel) preference for the requesting actor. */
const updatePreferenceSchema = z.object({
  organization_id: z.string().uuid(),
  event_type: z.string(),
  channel: z.string(),
  enabled: z.boolean(),
});

export const PATCH = withApiHandler(async (request) => {
  const actor = await getAuthenticatedUser();
  const json = await request.json().catch(() => null);
  const parsed = updatePreferenceSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'Invalid notification preference payload.',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }
  if (!isNotificationEventType(parsed.data.event_type)) {
    throw new AppError('validation_error', 'Unsupported event_type.', [
      { field: 'event_type', issue: 'Must be a recognized Notifications event type.' },
    ]);
  }
  if (!isNotificationChannel(parsed.data.channel)) {
    throw new AppError('validation_error', 'Unsupported channel.', [
      { field: 'channel', issue: 'Must be "email" or "sms".' },
    ]);
  }

  const preference = await updateNotificationPreference(getDb(), {
    organizationId: parsed.data.organization_id,
    actorUserId: actor.id,
    eventType: parsed.data.event_type,
    channel: parsed.data.channel,
    enabled: parsed.data.enabled,
  });

  return { data: serializeNotificationPreference(preference) };
});
