'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { PurchaseOrderDto, PurchaseOrderLineItemDto } from '@/lib/inventory-types';

/** Purchase Order detail — suppliers-prd.md §13: "'receive' action that creates corresponding `stock_movements` entries." */
export default function PurchaseOrderDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <PurchaseOrderDetailContent />
    </Suspense>
  );
}

function PurchaseOrderDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [order, setOrder] = useState<PurchaseOrderDto | null>(null);
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItemDto[]>([]);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const result = await apiRequest<{
        purchase_order: PurchaseOrderDto;
        line_items: PurchaseOrderLineItemDto[];
      }>(`/api/v1/purchase-orders/${params.id}?organization_id=${organizationId}`);
      setOrder(result.data.purchase_order);
      setLineItems(result.data.line_items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Purchase Order.');
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
      await apiRequest(`/api/v1/purchase-orders/${params.id}/${path}`, {
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

  const submitReceive = async () => {
    const lines = lineItems
      .map((item) => ({
        line_item_id: item.id,
        quantity_received: Number(receiveQuantities[item.id] ?? ''),
      }))
      .filter((line) => line.quantity_received > 0);
    if (lines.length === 0) return;
    await runAction('receive', { lines });
    setReceiveQuantities({});
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

  if (!order) {
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
        <h1 className="text-2xl font-semibold">Purchase Order</h1>
        <span className="rounded-full border px-3 py-1 text-sm capitalize">{order.status}</span>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Item</th>
            <th className="py-2">Ordered</th>
            <th className="py-2">Received</th>
            <th className="py-2">Unit Cost</th>
            {order.status === 'ordered' ? <th className="py-2">Receive Now</th> : null}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.id} className="border-border border-b">
              <td className="py-2">{item.inventory_item_id}</td>
              <td className="py-2">{item.quantity_ordered}</td>
              <td className="py-2">{item.quantity_received}</td>
              <td className="py-2">${item.unit_cost}</td>
              {order.status === 'ordered' ? (
                <td className="py-2">
                  <Input
                    className="w-24"
                    placeholder="0"
                    value={receiveQuantities[item.id] ?? ''}
                    onChange={(event) =>
                      setReceiveQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-2">
        {order.status === 'draft' ? (
          <Button disabled={actionPending} onClick={() => void runAction('order')}>
            Mark Ordered
          </Button>
        ) : null}
        {order.status === 'ordered' ? (
          <Button disabled={actionPending} onClick={() => void submitReceive()}>
            Receive
          </Button>
        ) : null}
        {order.status === 'draft' || order.status === 'ordered' ? (
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
