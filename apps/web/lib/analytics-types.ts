/** Client-side mirror of apps/web/lib/analytics-serializers.ts's JSON shape. */
export interface StalenessMeta {
  as_of: string | null;
  is_stale: boolean;
}

export interface RevenueByPeriodDto {
  period: string;
  total_revenue: string;
  payment_count: number;
}

export interface JobVolumeByTypeDto {
  job_type_id: string;
  status: string;
  job_count: number;
}

export interface TechnicianUtilizationDto {
  technician_user_id: string;
  period: string;
  scheduled_hours: string;
  job_count: number;
}

export interface InvoiceAgingDto {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  status: string;
  total: string;
  due_date: string | null;
  amount_paid: string;
  balance_due: string;
  days_overdue: number;
}
