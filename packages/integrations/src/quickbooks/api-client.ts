/**
 * QuickBooks Online Accounting API — integrations-prd.md §7 "scheduled +
 * on-demand sync of finalized Invoices and completed Payments." Every
 * Invoice's line items are mapped to a single generic "Sales" Item
 * (QuickBooks requires each `Line`'s `SalesItemLineDetail` to reference
 * an Item), and `CustomerRef` is a placeholder ("1") — Atlas has no
 * per-Organization QuickBooks Customer/Item account-mapping data model
 * yet. A real production integration needs one; this is a documented,
 * disclosed simplification (see
 * docs/13-roadmap/SPRINT-7-COMPLETION-REPORT.md, Known Limitations), not
 * a bug — and, like the rest of this provider's client, untestable live
 * in this sandbox (no registered QuickBooks app to call).
 */
const QUICKBOOKS_API_BASE = 'https://sandbox-quickbooks.api.intuit.com';

export class QuickBooksApiError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`QuickBooks API ${operation} failed: ${String(cause)}`);
    this.name = 'QuickBooksApiError';
  }
}

export interface QuickBooksLineItem {
  description: string;
  amount: number;
}

export interface CreateQuickBooksInvoiceParams {
  accessToken: string;
  realmId: string;
  docNumber: string;
  lineItems: QuickBooksLineItem[];
}

export interface QuickBooksInvoiceResult {
  quickBooksInvoiceId: string;
}

export async function createQuickBooksInvoice(
  params: CreateQuickBooksInvoiceParams,
): Promise<QuickBooksInvoiceResult> {
  const response = await fetch(`${QUICKBOOKS_API_BASE}/v3/company/${params.realmId}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      DocNumber: params.docNumber,
      CustomerRef: { value: '1' },
      Line: params.lineItems.map((item) => ({
        Amount: item.amount,
        DetailType: 'SalesItemLineDetail',
        Description: item.description,
        SalesItemLineDetail: { ItemRef: { value: '1', name: 'Services' } },
      })),
    }),
  });

  if (!response.ok) {
    throw new QuickBooksApiError('createInvoice', await response.text());
  }

  const data = (await response.json()) as { Invoice: { Id: string } };
  return { quickBooksInvoiceId: data.Invoice.Id };
}

export interface RecordQuickBooksPaymentParams {
  accessToken: string;
  realmId: string;
  quickBooksInvoiceId: string;
  totalAmt: number;
}

export interface QuickBooksPaymentResult {
  quickBooksPaymentId: string;
}

/** integrations-prd.md §7 "sync of ... completed Payments" — applied against the Invoice already synced by `createQuickBooksInvoice`. */
export async function recordQuickBooksPayment(
  params: RecordQuickBooksPaymentParams,
): Promise<QuickBooksPaymentResult> {
  const response = await fetch(`${QUICKBOOKS_API_BASE}/v3/company/${params.realmId}/payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      CustomerRef: { value: '1' },
      TotalAmt: params.totalAmt,
      Line: [{ Amount: params.totalAmt, LinkedTxn: [{ TxnId: params.quickBooksInvoiceId, TxnType: 'Invoice' }] }],
    }),
  });

  if (!response.ok) {
    throw new QuickBooksApiError('recordPayment', await response.text());
  }

  const data = (await response.json()) as { Payment: { Id: string } };
  return { quickBooksPaymentId: data.Payment.Id };
}
