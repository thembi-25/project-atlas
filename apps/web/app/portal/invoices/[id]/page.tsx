'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
import { Button, Input, Label } from '@atlas/ui';
import { apiRequest } from '@/lib/api-client';
import type { InvoiceDto, InvoiceLineItemDto, PaymentDto } from '@/lib/financials-types';

/**
 * Customer Portal Invoice payment view — customer-portal-prd.md, ADR-018.
 * Card only (no cash/check from a self-serve session). Uses Stripe's
 * vanilla Elements API (not `@stripe/react-stripe-js`, to keep this
 * single view self-contained rather than wrapping the whole Portal in an
 * Elements provider it doesn't otherwise need). Untestable live in this
 * sandbox (no configured Stripe keys — see docs/13-roadmap/sprint-5.md,
 * "Scope decisions"), written to be structurally correct once real
 * test-mode keys are supplied.
 */
export default function PortalInvoicePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<{
        invoice: InvoiceDto;
        line_items: InvoiceLineItemDto[];
        payments: PaymentDto[];
      }>(`/api/v1/portal/invoices/${params.id}`);
      setInvoice(result.data.invoice);
      setLineItems(result.data.line_items);
      setPayments(result.data.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Invoice.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!invoice) {
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

  const balanceDue = invoice.balance_due ?? Number(invoice.total);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : ''}
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
          <div className="font-semibold">${balanceDue}</div>
        </div>
      </div>

      {balanceDue > 0 ? (
        <PayForm invoiceId={params.id} balanceDue={balanceDue} onPaid={load} />
      ) : (
        <p className="text-muted-foreground text-sm">This Invoice is paid in full.</p>
      )}

      {payments.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Payment History</h2>
          <ul className="text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="border-border border-b py-2">
                ${payment.amount} — {payment.method} — {payment.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}

function PayForm({
  invoiceId,
  balanceDue,
  onPaid,
}: {
  invoiceId: string;
  balanceDue: number;
  onPaid: () => Promise<void>;
}): JSX.Element {
  const [amount, setAmount] = useState(String(balanceDue));
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentElementRef = useRef<HTMLDivElement>(null);

  const startPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiRequest<{ payment: PaymentDto; stripe_client_secret: string | null }>(
        `/api/v1/portal/invoices/${invoiceId}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(amount),
            idempotency_key: globalThis.crypto.randomUUID(),
          }),
        },
      );
      if (!result.data.stripe_client_secret) {
        throw new Error('Stripe did not return a client secret.');
      }
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error('Card payments are not yet configured for this deployment.');
      }
      const stripeInstance = await loadStripe(publishableKey);
      if (!stripeInstance) throw new Error('Failed to load Stripe.');
      const elementsInstance = stripeInstance.elements({
        clientSecret: result.data.stripe_client_secret,
      });
      const paymentElement = elementsInstance.create('payment');
      if (paymentElementRef.current) {
        paymentElement.mount(paymentElementRef.current);
      }
      setStripe(stripeInstance);
      setElements(elementsInstance);
      setClientSecret(result.data.stripe_client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = async () => {
    if (!stripe || !elements || !clientSecret) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed.');
      } else {
        await onPaid();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (clientSecret) {
    return (
      <div className="flex flex-col gap-3">
        <div ref={paymentElementRef} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button disabled={submitting} onClick={() => void confirmPayment()}>
          {submitting ? 'Processing…' : `Pay $${amount}`}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={startPayment} className="flex items-end gap-3">
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Starting…' : 'Pay by card'}
      </Button>
    </form>
  );
}
