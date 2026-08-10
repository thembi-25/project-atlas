import type {
  CreditNote,
  Estimate,
  EstimateLineItem,
  Invoice,
  InvoiceLineItem,
  Payment,
} from '@atlas/financials';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeEstimate(estimate: Estimate) {
  return {
    id: estimate.id,
    organization_id: estimate.organizationId,
    estimate_number: estimate.estimateNumber,
    job_id: estimate.jobId,
    customer_id: estimate.customerId,
    contact_id: estimate.contactId,
    status: estimate.status,
    subtotal: estimate.subtotal,
    tax_total: estimate.taxTotal,
    total: estimate.total,
    valid_until: estimate.validUntil ? estimate.validUntil.toISOString() : null,
    sent_at: estimate.sentAt ? estimate.sentAt.toISOString() : null,
    approved_at: estimate.approvedAt ? estimate.approvedAt.toISOString() : null,
    approved_by_contact_id: estimate.approvedByContactId,
    approved_by_user_id: estimate.approvedByUserId,
    rejected_at: estimate.rejectedAt ? estimate.rejectedAt.toISOString() : null,
    rejection_reason: estimate.rejectionReason,
    cancellation_reason: estimate.cancellationReason,
    supersedes_estimate_id: estimate.supersedesEstimateId,
    created_at: estimate.createdAt.toISOString(),
    updated_at: estimate.updatedAt.toISOString(),
  };
}

export function serializeEstimateLineItem(item: EstimateLineItem) {
  return {
    id: item.id,
    estimate_id: item.estimateId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
    sort_order: item.sortOrder,
  };
}

export function serializeInvoice(
  invoice: Invoice,
  extra?: { amount_paid: number; balance_due: number },
) {
  return {
    id: invoice.id,
    organization_id: invoice.organizationId,
    invoice_number: invoice.invoiceNumber,
    job_id: invoice.jobId,
    estimate_id: invoice.estimateId,
    customer_id: invoice.customerId,
    status: invoice.status,
    is_deposit: invoice.isDeposit,
    subtotal: invoice.subtotal,
    tax_total: invoice.taxTotal,
    total: invoice.total,
    amount_paid: extra?.amount_paid ?? null,
    balance_due: extra?.balance_due ?? null,
    due_date: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    finalized_at: invoice.finalizedAt ? invoice.finalizedAt.toISOString() : null,
    sent_at: invoice.sentAt ? invoice.sentAt.toISOString() : null,
    voided_at: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
    void_reason: invoice.voidReason,
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
  };
}

export function serializeInvoiceLineItem(item: InvoiceLineItem) {
  return {
    id: item.id,
    invoice_id: item.invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
    sort_order: item.sortOrder,
  };
}

export function serializeCreditNote(creditNote: CreditNote) {
  return {
    id: creditNote.id,
    invoice_id: creditNote.invoiceId,
    reason: creditNote.reason,
    amount: creditNote.amount,
    issued_by_user_id: creditNote.issuedByUserId,
    issued_at: creditNote.issuedAt.toISOString(),
  };
}

export function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    organization_id: payment.organizationId,
    invoice_id: payment.invoiceId,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    processor: payment.processor,
    processor_reference_id: payment.processorReferenceId,
    card_last4: payment.cardLast4,
    card_brand: payment.cardBrand,
    initiated_by: payment.initiatedBy,
    captured_by_user_id: payment.capturedByUserId,
    refund_of_payment_id: payment.refundOfPaymentId,
    completed_at: payment.completedAt ? payment.completedAt.toISOString() : null,
    failed_at: payment.failedAt ? payment.failedAt.toISOString() : null,
    refunded_at: payment.refundedAt ? payment.refundedAt.toISOString() : null,
    created_at: payment.createdAt.toISOString(),
  };
}
