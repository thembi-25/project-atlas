# Reporting — PRD

## 1. Purpose

Provide exportable, filterable reports (CSV/PDF) beyond the fixed dashboards in [Analytics](./analytics-prd.md) — the mechanism by which an Organization's own data leaves Atlas in a usable form, per [Product Principles](../00-overview/product-principles.md) principle 9.

## 2. Business problem

Owners and accountants periodically need data in a specific cut (e.g., "every Invoice for Q2, with Customer and Job Type") for tax prep, lender conversations, or year-end accounting — a fixed dashboard can't serve every such need, and Atlas must not be a data trap.

## 3. Goals

- Any core entity list (Jobs, Invoices, Payments, Customers) can be exported with the same filters available in its list view.
- Exports are complete (no silent row caps) and generated asynchronously for large data sets.
- PDF exports (Invoice, Estimate) are presentable, customer-facing documents, not raw data dumps.

## 4. Non-goals

- Self-service custom report/pivot-table building — see [Analytics PRD](./analytics-prd.md), Non-goals; Reporting provides structured exports of existing views, not an ad hoc query builder.

## 5. Personas

[Priya (Accountant)](../00-overview/user-personas.md) primarily, [Maria (Owner)](../00-overview/user-personas.md).

## 6. User stories

As an Accountant, I want to export all Invoices for a date range as CSV, so I can hand it to our tax preparer without re-typing anything.

## 7. Functional requirements

CSV export for every list endpoint honoring its existing filters (see [Filtering](../05-api/filtering.md)); PDF generation for Invoices/Estimates; asynchronous export job for large result sets with a download-when-ready notification.

## 8. Business rules

Exports are always scoped to the requesting User's Role/Permissions — an export can never return data the same User couldn't see via the normal API. Exports never bypass RLS.

## 9. State machines

Export job: `queued → processing → ready/failed` — processed by the [Background Worker](../02-architecture/container-architecture.md), not inline in the request, since large exports could exceed request timeout limits.

## 10. Data requirements

`export_jobs` (`organization_id`, `requested_by_user_id`, `resource_type`, `filters` jsonb, `status`, `file_url`, `expires_at`).

## 11. API requirements

`POST /api/v1/exports` (`resource_type`, `filters`), `GET /api/v1/exports/{id}` (status/download URL), `GET /api/v1/invoices/{id}/pdf`, `GET /api/v1/estimates/{id}/pdf`.

## 12. Permission requirements

An export request is authorized exactly as if it were the equivalent list request — e.g., a Technician cannot export organization-wide Invoices they couldn't otherwise list.

## 13. UI requirements

"Export" action on every list view, applying current filters; export history/download page; branded PDF template for Invoices/Estimates using the Organization's logo (see [Organization PRD](./organization-prd.md)).

## 14. Notifications

Export ready notification (in-app + email) when an asynchronous export completes.

## 15. Audit requirements

Every export request produces an [Audit Event](../03-domain/audit-events.md) — data leaving the system is itself a security-relevant event, particularly for bulk Customer/financial exports.

## 16. Error cases

Export request for a resource type the User has no read access to (`403`); expired export download link (`410`, must re-request).

## 17. Edge cases

A very large Organization requests a full multi-year Invoice export — handled by the asynchronous job path regardless of size, with the Worker streaming/batching the query rather than loading the full result set into memory at once.

## 18. Acceptance criteria

**Given** a filtered Job list view showing 340 results, **when** the user exports it, **then** the resulting CSV contains exactly those 340 rows with the same filter applied server-side, not just the currently-loaded page.

## 19. Testing requirements

Export-respects-filters-and-permissions tests; large-volume export performance tests; PDF-generation visual regression tests.

## 20. Future extensions

Scheduled/recurring report delivery (e.g., automatic weekly revenue email); direct export to Google Sheets.
