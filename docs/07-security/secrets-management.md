# Secrets Management

## Principle

No secret — database credential, third-party API key, JWT signing key, OAuth client secret — is ever committed to source control, hard-coded, or logged. This is a hard rule, not a preference, per [Engineering Standards](../08-engineering/coding-standards.md).

## Storage

- **Local development**: secrets live in a git-ignored `.env.local` file, sourced from a shared, access-controlled secret store (not emailed/Slacked in plaintext) — see [Local Development](../10-devops/local-development.md).
- **Preview/Staging/Production**: secrets are stored in Vercel's environment variable configuration (encrypted at rest by Vercel) and Supabase's project configuration, scoped per environment — a Preview secret is never the same value as a Production secret for anything credential-like.
- **Third-party integration credentials per Organization** (e.g., an Organization's QuickBooks OAuth token — see [Integrations PRD](../06-modules/integrations-prd.md)): stored encrypted at the database column level (application-layer encryption, since these are tenant-specific secrets distinct from platform infrastructure secrets), decrypted only in-process when needed for an outbound API call.

## Access control

- Production secrets are accessible only to a minimal set of engineers/service accounts, via Vercel/Supabase's own access control — not shared broadly "for convenience."
- Rotating a secret (e.g., after a suspected leak) is a documented, practiced procedure — see [Disaster Recovery](../10-devops/disaster-recovery.md) — not a first-time exercise during an actual incident.

## What counts as a secret (non-exhaustive)

Database connection strings, Supabase service-role key, Stripe secret key and webhook signing secret, Twilio auth token, Resend API key, QuickBooks OAuth client secret, Sentry auth token, any per-Organization OAuth access/refresh token.

## Preventing accidental leakage

- Pre-commit/CI secret-scanning (e.g., detecting patterns matching known API key formats) blocks a commit/PR containing an apparent secret.
- `.env.example` (committed, safe) documents every required variable name with a placeholder value — never a real one — so local setup is self-documenting without risking real credentials in git history.
- Logging (see [Logging](../10-devops/logging.md)) explicitly redacts known secret-shaped fields (`*_key`, `*_token`, `*_secret`, `password`) before any log line is emitted, as a backstop against a developer accidentally logging a full request/response object.

## Incident response for a leaked secret

If a secret leaks (accidental commit, exposed log, compromised third-party account): rotate immediately, audit for any use of the leaked credential during the exposure window, and record the incident per [Disaster Recovery](../10-devops/disaster-recovery.md). A leaked secret is treated as a security incident regardless of whether misuse is confirmed.

## Related documents

[Data Protection](./data-protection.md) · [Local Development](../10-devops/local-development.md) · [CI/CD](../10-devops/ci-cd.md) · [Disaster Recovery](../10-devops/disaster-recovery.md)
