'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { EstimateDto, EstimateLineItemDto } from '@/lib/financials-types';

/** Customer Portal Estimate approve/reject view — customer-portal-prd.md. */
export default function PortalEstimatePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [estimate, setEstimate] = useState<EstimateDto | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<{ estimate: EstimateDto; line_items: EstimateLineItemDto[] }>(
        `/api/v1/portal/estimates/${params.id}`,
      );
      setEstimate(result.data.estimate);
      setLineItems(result.data.line_items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Estimate.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (action: 'approve' | 'reject') => {
    setActionPending(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/portal/estimates/${params.id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionPending(false);
    }
  };

  if (!estimate) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estimate #{estimate.estimate_number}</h1>
        <span className="rounded-full border px-3 py-1 text-sm capitalize">{estimate.status}</span>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Description</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Unit Price</th>
            <th className="py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.id} className="border-border border-b">
              <td className="py-2">{item.description}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2">${item.unit_price}</td>
              <td className="py-2">${item.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6 text-right text-lg font-semibold">Total: ${estimate.total}</div>

      {estimate.status === 'sent' ? (
        <div className="flex gap-3">
          <Button disabled={actionPending} onClick={() => void respond('approve')}>
            Approve
          </Button>
          <Button variant="outline" disabled={actionPending} onClick={() => void respond('reject')}>
            Reject
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {estimate.status === 'approved' ? 'You approved this Estimate.' : null}
          {estimate.status === 'rejected' ? 'You rejected this Estimate.' : null}
          {estimate.status === 'expired' ? 'This Estimate has expired.' : null}
        </p>
      )}
    </main>
  );
}
