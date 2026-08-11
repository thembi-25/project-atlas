/**
 * Estimates, Invoicing & Payments domain module. See
 * docs/13-roadmap/sprint-5.md, docs/03-domain/estimates.md,
 * docs/03-domain/invoices.md, docs/03-domain/payments.md,
 * docs/06-modules/estimates-prd.md, docs/06-modules/invoicing-prd.md,
 * docs/06-modules/payments-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 */

// Domain
export {
  NotFoundError,
  ForbiddenError,
  InvalidEstimateStateError,
  InvalidInvoiceStateError,
  InvalidPaymentStateError,
  EstimateExpiredError,
  EstimateLineItemsImmutableError,
  InvoiceIsImmutableError,
  InvoiceNotFinalizableError,
  InvoiceHasPaymentsError,
  PaymentExceedsInvoiceBalanceError,
} from './domain/errors';
export {
  ESTIMATE_STATUSES,
  TERMINAL_ESTIMATE_STATUSES,
  canTransitionEstimateStatus,
  isTerminalEstimateStatus,
  INVOICE_STATUSES,
  TERMINAL_INVOICE_STATUSES,
  canTransitionInvoiceStatus,
  isTerminalInvoiceStatus,
  isInvoiceOverdue,
  PAYMENT_STATUSES,
  canTransitionPaymentStatus,
} from './domain/lifecycle';
export type { EstimateStatus, InvoiceStatus, PaymentStatus } from './domain/lifecycle';
export {
  roundToCents,
  computeLineTotal,
  computeSubtotal,
  computeTotal,
  computeAmountPaid,
  computeBalanceDue,
  dollarsToCents,
  centsToDollars,
} from './domain/money';

// Application use cases — Estimates
export { createEstimate } from './application/create-estimate';
export type { CreateEstimateParams, CreateEstimateResult } from './application/create-estimate';
export { getEstimate, listEstimates, updateEstimateDraft } from './application/manage-estimate';
export type {
  GetEstimateParams,
  GetEstimateResult,
  ListEstimatesParams,
  UpdateEstimateDraftParams,
  UpdateEstimateDraftLineItemInput,
} from './application/manage-estimate';
export type { EstimateCursor, EstimateSortField, SortDirection } from './infrastructure/estimates';
export {
  sendEstimate,
  approveEstimateAsStaff,
  approveEstimateInTx,
  rejectEstimateAsStaff,
  rejectEstimateInTx,
  cancelEstimate,
  convertEstimateToInvoice,
  generateInvoiceFromEstimateInTx,
} from './application/estimate-transitions';
export type {
  SendEstimateParams,
  ApproveEstimateStaffParams,
  RejectEstimateStaffParams,
  CancelEstimateParams,
  ConvertEstimateParams,
  ConvertEstimateResult,
  GenerateInvoiceFromEstimateParams,
} from './application/estimate-transitions';

// Application use cases — Invoices
export { createInvoice } from './application/create-invoice';
export type { CreateInvoiceParams, CreateInvoiceResult } from './application/create-invoice';
export {
  getInvoice,
  listInvoices,
  updateInvoiceDraft,
  listInvoicePayments,
} from './application/manage-invoice';
export type {
  GetInvoiceParams,
  GetInvoiceResult,
  ListInvoicesParams,
  UpdateInvoiceDraftParams,
  UpdateInvoiceDraftLineItemInput,
  ListInvoicePaymentsParams,
} from './application/manage-invoice';
export type { InvoiceCursor, InvoiceSortField } from './infrastructure/invoices';
export {
  finalizeInvoice,
  sendInvoice,
  voidInvoice,
  issueCreditNote,
  recomputeInvoiceStatusAfterPayment,
} from './application/invoice-transitions';
export type {
  FinalizeInvoiceParams,
  SendInvoiceParams,
  VoidInvoiceParams,
  IssueCreditNoteParams,
} from './application/invoice-transitions';

// Application use cases — Payments
export { capturePayment, recordPaymentReceivedEvent } from './application/capture-payment';
export type { CapturePaymentParams, CapturePaymentResult } from './application/capture-payment';
export { listPayments } from './application/manage-payment';
export type { ListPaymentsParams } from './application/manage-payment';
export { refundPayment } from './application/refund-payment';
export type { RefundPaymentParams, RefundPaymentResult } from './application/refund-payment';
export { processStripeWebhookEvent } from './application/stripe-webhook-handler';

// Application use cases — Customer Portal
export {
  approveEstimateAsPortalContact,
  rejectEstimateAsPortalContact,
} from './application/portal-estimate-actions';
export type {
  PortalEstimateActionParams,
  RejectEstimateAsPortalContactParams,
} from './application/portal-estimate-actions';
export { capturePaymentAsPortalContact } from './application/portal-capture-payment';
export type {
  PortalCapturePaymentParams,
  PortalCapturePaymentResult,
} from './application/portal-capture-payment';
export {
  getEstimateForPortalContact,
  getInvoiceForPortalContact,
} from './application/portal-reads';

export { requireFinancialsPermission } from './application/authorize';
export type { FinancialsResource } from './application/authorize';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type { Estimate } from './infrastructure/estimates';
export { findApprovedEstimateForJob, findEstimateById } from './infrastructure/estimates';
export type { EstimateLineItem } from './infrastructure/estimate-line-items';
export type { Invoice } from './infrastructure/invoices';
export { findInvoiceById } from './infrastructure/invoices';
export type { InvoiceLineItem } from './infrastructure/invoice-line-items';
export { listInvoiceLineItems } from './infrastructure/invoice-line-items';
export type { CreditNote } from './infrastructure/credit-notes';
export { listCreditNotesForInvoice } from './infrastructure/credit-notes';
export type { Payment, PaymentMethod, PaymentInitiatedBy } from './infrastructure/payments';
export { listPaymentsForInvoice, findPaymentById } from './infrastructure/payments';
