'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { EstimateDto, EstimateLineItemDto } from '@/lib/financials-types';

/** Estimate detail — estimates.md#state-machine, estimates-prd.md's transition actions. */
export default function EstimateDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <EstimateDetailContent />
    </Suspense>
  );
}

function EstimateDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [estimate, setEstimate] = useState<EstimateDto | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const result = await apiRequest<{ estimate: EstimateDto; line_items: EstimateLineItemDto[] }>(
        `/api/v1/estimates/${params.id}?organization_id=${organizationId}`,
      );
      setEstimate(result.data.estimate);
      setLineItems(result.data.line_items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Estimate.');
    }
  }, [organizationId, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (path: string, body: Record<string, unknown> = {}) => {
    if (!organizationId) return;
    setActionPending(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/estimates/${params.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, ...body }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionPending(false);
    }
  };

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL.
        </p>
      </main>
    );
  }

  if (!estimate) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
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

      <div className="mb-6 flex justify-end gap-8 text-sm">
        <div>
          <div className="text-muted-foreground">Subtotal</div>
          <div>${estimate.subtotal}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Tax</div>
          <div>${estimate.tax_total}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total</div>
          <div className="font-semibold">${estimate.total}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {estimate.status === 'draft' ? (
          <Button disabled={actionPending} onClick={() => void runAction('send')}>
            Send
          </Button>
        ) : null}
        {estimate.status === 'sent' ? (
          <>
            <Button disabled={actionPending} onClick={() => void runAction('approve')}>
              Record Approval
            </Button>
            <Button
              variant="outline"
              disabled={actionPending}
              onClick={() => void runAction('reject')}
            >
              Record Rejection
            </Button>
          </>
        ) : null}
        {estimate.status === 'approved' ? (
          <Button disabled={actionPending} onClick={() => void runAction('convert')}>
            Convert to Invoice
          </Button>
        ) : null}
        {estimate.status === 'draft' || estimate.status === 'sent' ? (
          <Button
            variant="outline"
            disabled={actionPending}
            onClick={() => void runAction('cancel')}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </main>
  );
}
