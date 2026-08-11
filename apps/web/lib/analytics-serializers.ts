import type {
  InvoiceAgingRow,
  JobVolumeByTypeRow,
  RevenueByPeriodRow,
  Staleness,
  TechnicianUtilizationRow,
} from '@atlas/analytics';

/** analytics-prd.md §13: every widget response carries its staleness alongside the rows — see docs/05-api/resource-conventions.md for the snake_case convention. */
export function serializeStaleness(staleness: Staleness) {
  return { as_of: staleness.asOf ? staleness.asOf.toISOString() : null, is_stale: staleness.isStale };
}

export function serializeRevenueByPeriodRow(row: RevenueByPeriodRow) {
  return { period: row.period, total_revenue: row.totalRevenue, payment_count: row.paymentCount };
}

export function serializeJobVolumeByTypeRow(row: JobVolumeByTypeRow) {
  return { job_type_id: row.jobTypeId, status: row.status, job_count: row.jobCount };
}

export function serializeTechnicianUtilizationRow(row: TechnicianUtilizationRow) {
  return {
    technician_user_id: row.technicianUserId,
    period: row.period,
    scheduled_hours: row.scheduledHours,
    job_count: row.jobCount,
  };
}

export function serializeInvoiceAgingRow(row: InvoiceAgingRow) {
  return {
    invoice_id: row.invoiceId,
    invoice_number: row.invoiceNumber,
    customer_id: row.customerId,
    status: row.status,
    total: row.total,
    due_date: row.dueDate,
    amount_paid: row.amountPaid,
    balance_due: row.balanceDue,
    days_overdue: row.daysOverdue,
  };
}
