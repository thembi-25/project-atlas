'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { IntegrationConnectionDto, SyncRecordDto } from '@/lib/quickbooks-types';

/**
 * Settings → Integrations — integrations-prd.md §13: "connect/disconnect
 * and sync-status/error visibility." No "retry sync" action in this
 * minimal UI pass (integrations-prd.md §13's other requirement) — see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known Limitations.
 */
export default function IntegrationsSettingsPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <IntegrationsSettingsPageContent />
    </Suspense>
  );
}

function IntegrationsSettingsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');
  const quickbooksStatus = searchParams.get('quickbooks');
  const quickbooksError = searchParams.get('quickbooks_error');

  const [connection, setConnection] = useState<IntegrationConnectionDto | null>(null);
  const [syncRecords, setSyncRecords] = useState<SyncRecordDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const result = await apiRequest<{ connection: IntegrationConnectionDto | null; sync_records: SyncRecordDto[] }>(
        `/api/v1/integrations/quickbooks/sync-status?organization_id=${organizationId}`,
      );
      setConnection(result.data.connection);
      setSyncRecords(result.data.sync_records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QuickBooks connection status.');
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (): Promise<void> => {
    if (!organizationId) return;
    setConnecting(true);
    setError(null);
    try {
      const result = await apiRequest<{ authorization_url: string }>('/api/v1/integrations/quickbooks/connect', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      });
      window.location.href = result.data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start QuickBooks connection.');
      setConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!organizationId) return;
    setDisconnecting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/integrations/quickbooks?organization_id=${organizationId}`, {
        method: 'DELETE',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect QuickBooks.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to manage Integrations for an Organization.
        </p>
      </main>
    );
  }

  const isConnected = connection?.status === 'connected';

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>

      {quickbooksStatus === 'connected' ? (
        <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          QuickBooks connected successfully.
        </p>
      ) : null}
      {quickbooksError ? (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          QuickBooks connection failed ({quickbooksError}). Try again.
        </p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <section className="border-border rounded-md border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">QuickBooks Online</h2>
            <p className="text-muted-foreground text-sm">
              {isConnected ? `Connected (Realm ${connection?.realm_id ?? '—'})` : 'Not connected'}
            </p>
          </div>
          {isConnected ? (
            <Button variant="outline" disabled={disconnecting} onClick={() => void disconnect()}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : (
            <Button disabled={connecting} onClick={() => void connect()}>
              {connecting ? 'Redirecting…' : 'Connect QuickBooks'}
            </Button>
          )}
        </div>

        {syncRecords.length > 0 ? (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-t text-left">
                <th className="py-2">Entity</th>
                <th className="py-2">Status</th>
                <th className="py-2">Last Attempted</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {syncRecords.map((record) => (
                <tr key={record.id} className="border-border border-t">
                  <td className="py-2">
                    {record.entity_type} {record.entity_id}
                  </td>
                  <td className="py-2">{record.status}</td>
                  <td className="py-2">
                    {record.last_attempted_at ? new Date(record.last_attempted_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 text-red-600">{record.error_detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
