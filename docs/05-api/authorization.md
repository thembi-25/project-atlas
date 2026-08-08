# Authorization

## Two-layer enforcement

Every request is authorized twice, independently — see [Permissions](../03-domain/permissions.md):

1. **API layer**: the route handler resolves the caller's effective Permissions from their Membership Role(s) and rejects with `403` before any database work if the requested action isn't covered.
2. **Database layer**: Row Level Security independently restricts which rows are visible/writable, regardless of what the API layer decided — see [Multi-Tenancy](../04-database/multi-tenancy.md).

## Example: insufficient permission

A Technician requesting the organization-wide revenue report:

```http
GET /api/v1/reports/revenue
Authorization: Bearer <technician-session-jwt>
```

```json
{
  "error": {
    "code": "forbidden",
    "message": "Your role does not have permission to access organization-wide reports."
  }
}
```
HTTP status `403`.

## Example: resource outside the caller's tenant

A User in Organization A requesting a Job that belongs to Organization B:

```http
GET /api/v1/jobs/{organization-b-job-id}
```

```json
{
  "error": {
    "code": "not_found",
    "message": "No job was found with the given ID."
  }
}
```
HTTP status `404` — **not** `403`. Returning `404` rather than `403` for cross-tenant resource access is deliberate: a `403` would confirm the resource exists (just not accessible to you), leaking information about another Organization's data. See [Acceptance Criteria](../01-product/acceptance-criteria.md), tenant isolation.

## Row-scoped authorization (e.g., Technician "assigned Jobs only")

Where a Role's access is row-scoped rather than all-or-nothing (Technician seeing only assigned Jobs — see [Roles](../03-domain/roles.md)), the RLS policy itself enforces the scoping (see [Multi-Tenancy](../04-database/multi-tenancy.md) for the policy pattern) — the API layer's role-based check confirms "Technicians can access the Jobs endpoint at all," and the database confirms "which specific rows." Neither layer alone is sufficient.

## Authorization is re-checked on every request

No authorization decision is cached beyond the lifetime of a single request. A Role change or Membership removal is effective on the very next request from that User — see [Multi-Tenancy](../04-database/multi-tenancy.md) for why this is checked against live Membership state rather than JWT claims.

## Related documents

[Authentication](./authentication.md) · [Permissions](../03-domain/permissions.md) · [Roles](../03-domain/roles.md) · [Tenant Isolation](../07-security/tenant-isolation.md)
