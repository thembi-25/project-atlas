# Authentication

## Mechanism

Atlas delegates authentication to **Supabase Auth**. See [ADR-006: Authentication](../11-adr/ADR-006-authentication.md). Atlas does not implement its own password storage, hashing, or session token issuance.

## Launch-scope authentication methods

- Email + password (with Supabase Auth's standard secure password policy and hashing).
- TOTP-based MFA, required for Owner/Admin Roles, optional for others — see [Authentication Security](../07-security/authentication-security.md).
- OAuth (Google) as a fast-follow, not blocking launch.
- The Customer Portal uses a separate, scoped authentication flow for Contacts (magic-link email, not full password accounts) — see [Customer Portal PRD](../06-modules/customer-portal-prd.md).

## Session handling

1. On successful login, Supabase Auth issues a JWT (short-lived access token + refresh token).
2. The Next.js app stores these in an `httpOnly`, `Secure`, `SameSite=Lax` cookie — never in `localStorage`, to reduce XSS token-theft exposure. See [API Security](../07-security/api-security.md).
3. Every `/api/v1/` request is authenticated by validating this JWT server-side (Supabase's JWT verification, checked against the project's signing key).
4. The API additionally resolves the caller's **current** Organization Memberships from the database on every request (not solely from JWT claims) — see [Multi-Tenancy](../04-database/multi-tenancy.md) for why this matters for timely permission revocation.

## Example: authenticated request

```http
GET /api/v1/jobs?status=scheduled
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

An unauthenticated or expired-token request receives:

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "A valid session is required to access this resource."
  }
}
```
with HTTP status `401`.

## API keys (for third-party/future integration use)

For non-interactive integrations (future Marketplace/Manufacturer partners, Zapier-style automation), Atlas issues Organization-scoped API keys (hashed at rest, never displayed again after creation, revocable) as a bearer credential alternative to a user session — scoped to specific Permissions at issuance, never broader than the issuing User's own access. Not required for launch scope beyond the first-party web app. See [Integrations](./integrations.md).

## Multi-Organization sessions

A User belonging to multiple Organizations selects an "active Organization" per session (stored client-side, validated server-side on every request against their actual Memberships) — the API never infers which Organization a request is "for" from anything other than an explicit, validated selection or the resource path itself.

## Related documents

[Authorization](./authorization.md) · [Authentication Security](../07-security/authentication-security.md) · [ADR-006](../11-adr/ADR-006-authentication.md) · [Users](../03-domain/users.md)
