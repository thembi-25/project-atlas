import { getInvoiceForPortalContact } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { withApiHandler } from '@/lib/route-handler';
import {
  serializeInvoice,
  serializeInvoiceLineItem,
  serializePayment,
} from '@/lib/financials-serializers';

/** GET /api/v1/portal/invoices/{id} — Customer Portal Invoice payment view. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(
  async (_request, context) => {
    const actor = await getAuthenticatedUser();
    const result = await getInvoiceForPortalContact(getDb(), {
      portalUserId: actor.id,
      invoiceId: context.params.id,
    });
    return {
      data: {
        invoice: serializeInvoice(result.invoice, {
          amount_paid: result.amountPaid,
          balance_due: result.balanceDue,
        }),
        line_items: result.lineItems.map(serializeInvoiceLineItem),
        payments: result.payments.map(serializePayment),
      },
    };
  },
);
