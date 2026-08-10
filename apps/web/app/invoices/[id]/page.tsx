'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InvoiceDto, InvoiceLineItemDto, PaymentDto } from '@/lib/financials-types';

/** Invoice detail — invoices.md#state-machine, invoicing-prd.md's transition actions and payment recording. */
export default function InvoiceDetailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <InvoiceDetailContent />
    </Suspense>
  );
}

function InvoiceDetailContent(): JSX.Element {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization_id');

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const [invoiceResult, paymentsResult] = await Promise.all([
        apiRequest<{ invoice: InvoiceDto; line_items: InvoiceLineItemDto[] }>(
          `/api/v1/invoices/${params.id}?organization_id=${organizationId}`,
        ),
        apiRequest<PaymentDto[]>(
          `/api/v1/invoices/${params.id}/payments?organization_id=${organizationId}`,
        ),
      ]);
      setInvoice(invoiceResult.data.invoice);
      setLineItems(invoiceResult.data.line_items);
      setPayments(paymentsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Invoice.');
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
      await apiRequest(`/api/v1/invoices/${params.id}/${path}`, {
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

  if (!invoice) {
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
        <h1 className="text-2xl font-semibold">
          Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : '(draft)'}
        </h1>
        <span className="rounded-full border px-3 py-1 text-sm capitalize">
          {invoice.status.replace('_', ' ')}
        </span>
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
          <div className="text-muted-foreground">Total</div>
          <div>${invoice.total}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Paid</div>
          <div>${invoice.amount_paid ?? '0.00'}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Balance Due</div>
          <div className="font-semibold">${invoice.balance_due ?? invoice.total}</div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {invoice.status === 'draft' ? (
          <Button disabled={actionPending} onClick={() => void runAction('finalize')}>
            Finalize
          </Button>
        ) : null}
        {invoice.status === 'finalized' ? (
          <Button disabled={actionPending} onClick={() => void runAction('send')}>
            Send
          </Button>
        ) : null}
        {invoice.status === 'draft' || invoice.status === 'finalized' ? (
          <VoidButton disabled={actionPending} onVoid={(reason) => runAction('void', { reason })} />
        ) : null}
      </div>

      {invoice.status === 'sent' || invoice.status === 'partially_paid' ? (
        <RecordPaymentForm
          invoiceId={params.id}
          organizationId={organizationId}
          onRecorded={load}
        />
      ) : null}

      <h2 className="mb-2 mt-6 text-lg font-semibold">Payments</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left">
            <th className="py-2">Method</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Status</th>
            <th className="py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-border border-b">
              <td className="py-2 capitalize">{payment.method}</td>
              <td className="py-2">${payment.amount}</td>
              <td className="py-2 capitalize">{payment.status}</td>
              <td className="py-2">{new Date(payment.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {payments.length === 0 ? (
            <tr>
              <td className="text-muted-foreground py-4" colSpan={4}>
                No Payments recorded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}

function VoidButton({
  disabled,
  onVoid,
}: {
  disabled: boolean;
  onVoid: (reason: string) => void;
}): JSX.Element {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  if (!showReason) {
    return (
      <Button variant="outline" disabled={disabled} onClick={() => setShowReason(true)}>
        Void
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Void reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Button
        variant="outline"
        disabled={disabled || !reason}
        onClick={() => {
          onVoid(reason);
          setShowReason(false);
          setReason('');
        }}
      >
        Confirm Void
      </Button>
    </div>
  );
}

function RecordPaymentForm({
  invoiceId,
  organizationId,
  onRecorded,
}: {
  invoiceId: string;
  organizationId: string;
  onRecorded: () => Promise<void>;
}): JSX.Element {
  const [method, setMethod] = useState<'cash' | 'check' | 'card'>('cash');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          amount: Number(amount),
          method,
          idempotency_key: globalThis.crypto.randomUUID(),
        }),
      });
      setAmount('');
      await onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record Payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border mb-6 flex items-end gap-3 rounded-md border p-4"
    >
      <div>
        <Label htmlFor="method">Method</Label>
        <select
          id="method"
          className="border-border h-9 rounded-md border bg-transparent px-3 text-sm"
          value={method}
          onChange={(event) => setMethod(event.target.value as 'cash' | 'check' | 'card')}
        >
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="card">Card (Stripe)</option>
        </select>
      </div>
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Recording…' : 'Record Payment'}
      </Button>
    </form>
  );
}
