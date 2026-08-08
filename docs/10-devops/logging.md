# Logging

## What is logged

- Every API request: method, path, status code, duration, `request_id`, authenticated `organization_id`/`user_id` (never PII beyond IDs — see Redaction below).
- Every unhandled exception: full stack trace, `request_id` correlation, sent to Sentry with breadcrumbs.
- Every Background Worker job execution: job type, outcome (success/failure/retry), duration.
- Every third-party integration call: outcome, latency, and (on failure) the provider's error code — never the full request/response body if it could contain sensitive data (e.g., a Stripe payment payload).

## Pipeline

Vercel log drains → **Axiom** for structured log aggregation and query; Sentry for error-specific tracking with richer context (breadcrumbs, user session replay where privacy-appropriate). See [Technology Stack](../02-architecture/technology-stack.md).

## Correlation

Every request is assigned a `request_id` at the edge (propagated through to the Worker for any asynchronous processing that request triggered), returned to the client as an `X-Request-Id` header (see [Errors](../05-api/errors.md)) — this is the mechanism by which a user-reported issue ("I got an error at 2:15pm") is correlated to the exact server-side log entries and, if relevant, [Audit Events](../03-domain/audit-events.md).

## Redaction (mandatory, automatic)

Before any log line is emitted, known secret- and PII-shaped fields are redacted: `password`, `*_token`, `*_key`, `*_secret`, full card numbers (never present per [Data Protection](../07-security/data-protection.md), but redaction exists as defense in depth), and full Customer PII fields in request/response body logging (only IDs are logged, not names/addresses/phone numbers, for routine request logs — see [Secrets Management](../07-security/secrets-management.md)).

## Log levels

`error` (unhandled exceptions, failed integration calls after retry exhaustion), `warn` (retried-but-recovered failures, deprecated API usage), `info` (request lifecycle, job execution outcomes), `debug` (verbose, local/Staging only, never enabled by default in Production given both noise and cost).

## Retention

Operational logs (Axiom) are retained 30–90 days (tunable, balancing debugging usefulness against storage cost) — this is distinct from and much shorter than [Audit Logging](../04-database/audit-logging.md)'s 3–7 year retention, since operational logs are a debugging tool, not the compliance record; the compliance record is the `audit_events` table itself.

## What is never logged

Raw payment card data (never present in the system at all), full request bodies containing Customer PII, database credentials or any secret listed in [Secrets Management](../07-security/secrets-management.md).

## Related documents

[Monitoring](./monitoring.md) · [Errors](../05-api/errors.md) · [Secrets Management](../07-security/secrets-management.md) · [Audit Logging](../04-database/audit-logging.md)
