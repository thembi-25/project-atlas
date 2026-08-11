'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationPreferenceDto,
} from '@/lib/notifications-types';

/** notifications-prd.md §13: "Notification preference settings page (per event type, per channel)." */
export default function NotificationSettingsPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <NotificationSettingsPageContent />
    </Suspense>
  );
}

function NotificationSettingsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [preferences, setPreferences] = useState<NotificationPreferenceDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const result = await apiRequest<NotificationPreferenceDto[]>(
        `/api/v1/notification-preferences?organization_id=${organizationId}`,
      );
      setPreferences(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification preferences.');
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isEnabled = (eventType: string, channel: string): boolean => {
    const pref = preferences.find((p) => p.event_type === eventType && p.channel === channel);
    return pref ? pref.enabled : true; // absence of a row means enabled — see @atlas/notifications's isChannelEnabled.
  };

  const toggle = async (eventType: string, channel: string): Promise<void> => {
    if (!organizationId) return;
    const key = `${eventType}:${channel}`;
    setSavingKey(key);
    setError(null);
    try {
      await apiRequest('/api/v1/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          organization_id: organizationId,
          event_type: eventType,
          channel,
          enabled: !isEnabled(eventType, channel),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preference.');
    } finally {
      setSavingKey(null);
    }
  };

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to manage your notification preferences.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Notification Preferences</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Disabling a channel never disables the underlying action — you just won&apos;t be notified about it.
      </p>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Event</th>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <th key={channel} className="py-2 capitalize">
                {channel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_EVENT_TYPES.map((eventType) => (
            <tr key={eventType} className="border-border border-b">
              <td className="py-2">{eventType}</td>
              {NOTIFICATION_CHANNELS.map((channel) => {
                const key = `${eventType}:${channel}`;
                return (
                  <td key={channel} className="py-2">
                    <input
                      type="checkbox"
                      checked={isEnabled(eventType, channel)}
                      disabled={savingKey === key}
                      onChange={() => void toggle(eventType, channel)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
