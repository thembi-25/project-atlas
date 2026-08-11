import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuickBooksInvoice, QuickBooksApiError, recordQuickBooksPayment } from './api-client';

describe('createQuickBooksInvoice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful invoice-creation response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ Invoice: { Id: 'qb-inv-1' } }) }),
    );

    const result = await createQuickBooksInvoice({
      accessToken: 'at_fake',
      realmId: 'realm_fake',
      docNumber: 'INV-1001',
      lineItems: [{ description: 'Labor', amount: 100 }],
    });

    expect(result).toEqual({ quickBooksInvoiceId: 'qb-inv-1' });
  });

  it('wraps a non-ok response in QuickBooksApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('bad request') }));

    await expect(
      createQuickBooksInvoice({ accessToken: 'at_fake', realmId: 'realm_fake', docNumber: 'INV-1001', lineItems: [] }),
    ).rejects.toThrow(QuickBooksApiError);
  });
});

describe('recordQuickBooksPayment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful payment response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ Payment: { Id: 'qb-pay-1' } }) }),
    );

    const result = await recordQuickBooksPayment({
      accessToken: 'at_fake',
      realmId: 'realm_fake',
      quickBooksInvoiceId: 'qb-inv-1',
      totalAmt: 100,
    });

    expect(result).toEqual({ quickBooksPaymentId: 'qb-pay-1' });
  });
});
