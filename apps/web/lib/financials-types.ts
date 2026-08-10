/** Client-side mirror of apps/web/lib/financials-serializers.ts's JSON shape. */
export interface EstimateLineItemDto {
  id: string;
  estimate_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  sort_order: number;
}

export interface EstimateDto {
  id: string;
  organization_id: string;
  estimate_number: number;
  job_id: string;
  customer_id: string;
  contact_id: string | null;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted' | 'cancelled';
  subtotal: string;
  tax_total: string;
  total: string;
  valid_until: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_contact_id: string | null;
  approved_by_user_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  supersedes_estimate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItemDto {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  sort_order: number;
}

export interface InvoiceDto {
  id: string;
  organization_id: string;
  invoice_number: number | null;
  job_id: string;
  estimate_id: string | null;
  customer_id: string;
  status: 'draft' | 'finalized' | 'sent' | 'partially_paid' | 'paid' | 'void';
  is_deposit: boolean;
  subtotal: string;
  tax_total: string;
  total: string;
  amount_paid: number | null;
  balance_due: number | null;
  due_date: string | null;
  finalized_at: string | null;
  sent_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentDto {
  id: string;
  organization_id: string;
  invoice_id: string;
  amount: string;
  method: 'card' | 'ach' | 'cash' | 'check' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processor: string | null;
  processor_reference_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
  initiated_by: 'staff' | 'customer_portal';
  captured_by_user_id: string | null;
  refund_of_payment_id: string | null;
  completed_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  created_at: string;
}
