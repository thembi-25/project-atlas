# Authorization Security

## Model

Atlas's authorization model is documented functionally in [Roles](../03-domain/roles.md), [Permissions](../03-domain/permissions.md), and [Authorization](../05-api/authorization.md). This document covers the security-specific hardening around that model: what could go wrong, and what prevents it.

## Threats specifically addressed

| Threat | Control |
|---|---|
| Privilege escalation via a compromised low-privilege account | Every privileged action (Role change, billing, deletion) independently re-checks the caller's current Role at request time — no client-supplied Role/Permission claim is ever trusted | 
| A bug in one route handler's permission check exposes data | RLS at the database layer is an independent, second enforcement point — see [Tenant Isolation](./tenant-isolation.md) | 
| Stale permissions after a Role downgrade/removal | Authorization checks read live Membership state every request, never a cached JWT claim — see [Multi-Tenancy](../04-database/multi-tenancy.md) | 
| Insecure direct object reference (IDOR) — guessing another Organization's resource ID | UUID (non-sequential, non-guessable) primary keys plus RLS — even a guessed ID returns `404`, never data — see [Primary Keys](../04-database/primary-keys.md) | 
| Confused-deputy attacks via the Background Worker | The Worker's database role operates with the same RLS-scoped, transaction-tagged context as the triggering request (the enqueuing transaction records the acting `organization_id`/`user_id`, which the Worker restores when processing), never a blanket bypass-RLS service role for convenience | 

## The "never trust client-supplied tenant/role context" rule

No endpoint accepts an `organization_id`, `role`, or `permission` value from the request body/query string and uses it to make an authorization decision. The caller's Organization context and Role are **always** resolved server-side from their authenticated session and current Membership — see [Authentication](../05-api/authentication.md), Multi-Organization sessions.

## Service-role usage is exceptional and logged

The application's normal runtime database role is RLS-constrained. A small number of legitimate operations (platform-admin actions, the seed-data pipeline — see [Seed Data](../04-database/seed-data.md)) require an elevated, RLS-bypassing service role. Every such use is:
1. Isolated to a specific, narrow, reviewed code path — never the default connection used by ordinary request handling.
2. Logged with an explicit `service_role_action` Audit Event distinct from ordinary user-attributed events.

## Testing requirement

Every new endpoint's permission matrix (which Roles can do what) is captured as an explicit test table and verified in CI — see [Security Testing](../09-testing/security-testing.md). A new endpoint without an authorization test is treated as a blocking gap in [Definition of Done](../12-claude/definition-of-done.md).

## Related documents

[Authorization](../05-api/authorization.md) · [Tenant Isolation](./tenant-isolation.md) · [Roles](../03-domain/roles.md) · [Permissions](../03-domain/permissions.md)
