'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InvoiceDto } from '@/lib/financials-types';

/** Invoice list — invoicing-prd.md. Same `?organization_id=` limitation as every other Sprint 2-4 list page. */
export default function InvoicesPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <InvoicesPageContent />
    </Suspense>
  );
}

function InvoicesPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (opts: { cursor?: string | null; append?: boolean } = {}) => {
      if (!organizationId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ organization_id: organizationId, limit: '25' });
        if (opts.cursor) params.set('cursor', opts.cursor);
        const result = await apiRequest<InvoiceDto[]>(`/api/v1/invoices?${params.toString()}`);
        setInvoices((prev) => (opts.append ? [...prev, ...result.data] : result.data));
        setCursor(result.meta?.next_cursor ?? null);
        setHasMore(result.meta?.has_more ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Invoices.');
      } finally {
        setLoading(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground text-sm">
          Add <code className="bg-muted rounded px-1 py-0.5">?organization_id=&lt;id&gt;</code> to
          the URL to view Invoices for an Organization.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New Invoice'}
        </Button>
      </div>

      {showCreate ? (
        <CreateInvoiceForm
          organizationId={organizationId}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">#</th>
            <th className="py-2">Status</th>
            <th className="py-2">Total</th>
            <th className="py-2">Due</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-border border-b">
              <td className="py-2">
                <Link
                  className="hover:underline"
                  href={`/invoices/${invoice.id}?organization_id=${organizationId}`}
                >
                  {invoice.invoice_number ?? 'draft'}
                </Link>
              </td>
              <td className="py-2 capitalize">{invoice.status.replace('_', ' ')}</td>
              <td className="py-2">${invoice.total}</td>
              <td className="py-2">
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
          {invoices.length === 0 && !loading ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={4}>
                No Invoices found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {hasMore ? (
        <div className="mt-4">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load({ cursor, append: true })}
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </main>
  );
}

interface DraftLineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

function CreateInvoiceForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}): JSX.Element {
  const [jobId, setJobId] = useState('');
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    { description: '', quantity: '1', unit_price: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (index: number, field: keyof DraftLineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          job_id: jobId,
          line_items: lineItems
            .filter((item) => item.description && item.unit_price)
            .map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
            })),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-6 flex flex-col gap-3 rounded-md border p-4"
    >
      <p className="text-muted-foreground text-xs">
        Ad hoc Invoice (no Estimate). To bill from an approved Estimate instead, use the
        &ldquo;Convert to Invoice&rdquo; action on the Estimate.
      </p>
      <div>
        <Label htmlFor="job_id">Job ID</Label>
        <Input
          id="job_id"
          required
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Line Items</Label>
        {lineItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Description"
              className="flex-1"
              value={item.description}
              onChange={(event) => updateItem(index, 'description', event.target.value)}
            />
            <Input
              placeholder="Qty"
              className="w-20"
              value={item.quantity}
              onChange={(event) => updateItem(index, 'quantity', event.target.value)}
            />
            <Input
              placeholder="Unit price"
              className="w-28"
              value={item.unit_price}
              onChange={(event) => updateItem(index, 'unit_price', event.target.value)}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setLineItems((prev) => [...prev, { description: '', quantity: '1', unit_price: '' }])
          }
        >
          + Add line item
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  );
}
