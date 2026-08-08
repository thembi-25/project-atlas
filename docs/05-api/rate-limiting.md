# Rate Limiting

## Purpose

Protect the API from accidental (buggy client, retry storm) or intentional abuse, and ensure one Organization's usage cannot degrade service for others — consistent with [Non-Functional Requirements](../01-product/non-functional-requirements.md).

## Scope and limits (launch defaults)

| Scope | Limit | Applies to |
|---|---|---|
| Per authenticated session (User) | 300 requests / minute | All `/api/v1/` traffic from the first-party web/mobile app |
| Per Organization (aggregate, via API keys) | 1,000 requests / minute | Future third-party integrations — see [Integrations](./integrations.md) |
| Per IP, unauthenticated endpoints (login, password reset) | 10 requests / minute | Brute-force protection — see [Authentication Security](../07-security/authentication-security.md) |

These are launch defaults, tunable per environment without a code change (configuration, not hard-coded), and are deliberately generous for normal interactive use — they exist to catch runaway/abusive patterns, not to constrain legitimate office/field usage.

## Mechanism

Rate limiting is implemented as a Postgres-backed sliding-window counter (a simple table + a scheduled cleanup, consistent with [Architecture Principles](../02-architecture/architecture-principles.md) principle 4 — no Redis introduced solely for this), acceptable at launch request volumes; if sustained request volume ever makes a Postgres-backed limiter itself a bottleneck, that becomes one of the documented triggers for introducing Redis under [ADR-015](../11-adr/ADR-015-caching.md).

## Response when rate-limited

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Please retry after the time indicated in the Retry-After header."
  }
}
```
HTTP status `429`, with a `Retry-After` header (seconds) and `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset` headers on every response (not just `429`s) so well-behaved clients can self-throttle proactively.

## Endpoints with tighter, purpose-specific limits

- Login/password-reset/MFA endpoints: tighter per-IP limits specifically to blunt credential-stuffing/brute-force attempts — see [Authentication Security](../07-security/authentication-security.md).
- Payment capture endpoints: limited per-Job/per-Invoice (not just per-session) to prevent a retry loop from hammering the payment processor even within an otherwise-generous session limit.

## Related documents

[Errors](./errors.md) · [Authentication Security](../07-security/authentication-security.md) · [API Security](../07-security/api-security.md)
