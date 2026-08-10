import { z } from 'zod';
import { getInvoice, updateInvoiceDraft } from '@atlas/financials';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { withApiHandler } from '@/lib/route-handler';
import { serializeInvoice, serializeInvoiceLineItem } from '@/lib/financials-serializers';

/** GET /api/v1/invoices/{id} — invoices.md. `amount_paid`/`balance_due` are always computed. */
export const GET = withApiHandler<unknown, { params: { id: string } }>(async (request, context) => {
  const actor = await getAuthenticatedUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');
  if (!organizationId) {
    throw new AppError('bad_request', 'organization_id query parameter is required.');
  }
  const result = await getInvoice(getDb(), {
    organizationId,
    actorUserId: actor.id,
    invoiceId: context.params.id,
  });
  return {
    data: {
      invoice: serializeInvoice(result.invoice, {
        amount_paid: result.amountPaid,
        balance_due: result.balanceDue,
      }),
      line_items: result.lineItems.map(serializeInvoiceLineItem),
    },
  };
});

/** PATCH /api/v1/invoices/{id} — invoices.md business rule 1: editable only while `draft`. */
const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const updateInvoiceSchema = z.object({
  organization_id: z.string().uuid(),
  due_date: z.string().datetime().nullable().optional(),
  tax_total: z.number().nonnegative().optional(),
  line_items: z.array(lineItemSchema).min(1),
});

export const PATCH = withApiHandler<unknown, { params: { id: string } }>(
  async (request, context) => {
    const actor = await getAuthenticatedUser();
    const json = await request.json().catch(() => null);
    const parsed = updateInvoiceSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        'validation_error',
        'Invalid invoice payload.',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
      );
    }

    const result = await updateInvoiceDraft(getDb(), {
      organizationId: parsed.data.organization_id,
      actorUserId: actor.id,
      invoiceId: context.params.id,
      dueDate:
        parsed.data.due_date === undefined
          ? undefined
          : parsed.data.due_date === null
            ? null
            : new Date(parsed.data.due_date),
      taxTotal: parsed.data.tax_total,
      lineItems: parsed.data.line_items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
    });

    return {
      data: {
        invoice: serializeInvoice(result.invoice, {
          amount_paid: result.amountPaid,
          balance_due: result.balanceDue,
        }),
        line_items: result.lineItems.map(serializeInvoiceLineItem),
      },
    };
  },
);
