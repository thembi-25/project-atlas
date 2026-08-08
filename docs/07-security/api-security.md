# API Security

## Injection prevention

- **SQL injection**: eliminated structurally — all database access goes through Drizzle ORM's parameterized query builder; raw string-concatenated SQL is disallowed by code review and lint rule (no template-literal SQL construction from request input). See [Database Instructions](../12-claude/database-instructions.md).
- **NoSQL/command injection**: not applicable (no NoSQL datastore, no shell-out to OS commands from request-handling code).

## XSS prevention

- React's default JSX escaping is the primary defense — Atlas does not use `dangerouslySetInnerHTML` on any user-supplied content. See [Request Validation](../05-api/request-validation.md), Sanitization.
- Response `Content-Type` headers are always explicit and correct (`application/json` for the API, preventing browser MIME-sniffing misinterpretation).
- A strict `Content-Security-Policy` header is set on all web app responses, disallowing inline scripts from untrusted sources.

## CSRF protection

- Session cookies are `SameSite=Lax`, which blocks the classic cross-site form-submission CSRF vector for state-changing requests by default.
- State-changing `/api/v1/` requests additionally require a custom header (implicitly present for same-origin fetch/XHR requests, absent in a naive cross-site form POST) as a second layer, consistent with defense-in-depth.
- Webhook endpoints (which are intentionally called cross-origin, by third parties) are exempted from CSRF cookie-based checks but instead require signature verification — see [Webhooks](../05-api/webhooks.md).

## Output validation (preventing over-exposure)

Every response payload is checked against its expected shape (typed Zod schema per endpoint, see [Request Validation](../05-api/request-validation.md)) in development/test builds, specifically to catch an endpoint accidentally returning an internal-only field (e.g., `unit_cost_at_time` on a Customer Portal-facing Job view) before it reaches production.

## Transport security

TLS 1.2+ only; HTTP requests are redirected to HTTPS at the edge (Vercel), never served in plaintext even for a redirect response body.

## Rate limiting and abuse prevention

See [Rate Limiting](../05-api/rate-limiting.md) — per-session, per-Organization, and per-IP (for unauthenticated endpoints) limits.

## Security headers

`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (Atlas is never legitimately framed by a third-party site), `Referrer-Policy: strict-origin-when-cross-origin` — applied platform-wide via Next.js middleware.

## Dependency security

Automated dependency vulnerability scanning runs in CI (see [Dependency Management](../08-engineering/dependency-management.md)); a high/critical vulnerability in a dependency blocks merge until resolved or explicitly, temporarily accepted with a documented reason and follow-up ticket.

## Related documents

[Request Validation](../05-api/request-validation.md) · [Authentication Security](./authentication-security.md) · [Rate Limiting](../05-api/rate-limiting.md) · [Dependency Management](../08-engineering/dependency-management.md)
