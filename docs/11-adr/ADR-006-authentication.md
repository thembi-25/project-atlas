# ADR-006: Authentication via Supabase Auth

## Status

Accepted

## Date

2026-08-08

## Context

Atlas needs secure, standard authentication (email/password, MFA, eventually OAuth) for staff Users, and a lighter-weight, distinct authentication path for Customer Portal Contacts (see [Customer Portal PRD](../06-modules/customer-portal-prd.md)) — without the team building and maintaining password-hashing, session-management, and MFA infrastructure from scratch.

## Problem

Should Atlas implement its own authentication system, or delegate to a dedicated identity provider — and if delegating, to which one?

## Decision

**Supabase Auth** issues and verifies JWTs for all authenticated sessions; Atlas never stores password hashes itself. See [Authentication](../05-api/authentication.md), [Authentication Security](../07-security/authentication-security.md).

## Alternatives Considered

1. **Build authentication in-house** — rejected outright. Password hashing, session/token management, and MFA are security-critical, well-solved problems; building them from scratch introduces risk with no corresponding product differentiation, directly contradicting the "no unjustified infrastructure/dependency" principle in [Architecture Principles](../02-architecture/architecture-principles.md).
2. **A dedicated third-party identity provider (Auth0, Clerk, WorkOS)** — a credible alternative with strong feature sets (especially Clerk/WorkOS for B2B multi-tenant patterns); rejected in favor of Supabase Auth specifically because it's already part of the platform selected in [ADR-005](./ADR-005-supabase.md), avoiding a fourth vendor relationship, and its JWT-based session model integrates directly with the RLS-based authorization design in [ADR-007](./ADR-007-multi-tenancy.md) and [ADR-008](./ADR-008-rbac.md).
3. **NextAuth.js (Auth.js) with a custom credentials provider** — rejected. Would still require Atlas to own password storage/hashing unless paired with an external provider anyway, at which point Supabase Auth is the simpler direct choice given the already-selected platform.

## Consequences

- No password hash storage or session-token issuance logic to build/maintain/audit in-house.
- Session cookies are `httpOnly`/`Secure`/`SameSite=Lax` (see [Authentication Security](../07-security/authentication-security.md)), following Supabase's recommended integration pattern for Next.js.
- Organization/Role context is deliberately **not** carried as a long-lived JWT custom claim, but resolved from live `organization_memberships` state on every request — see [ADR-007](./ADR-007-multi-tenancy.md) for the specific rationale (avoiding stale-permission windows).
- The Customer Portal uses a distinct, magic-link-based authentication flow atop the same Supabase Auth primitive, kept structurally separate from staff Membership-based access (see [Customer Portal PRD](../06-modules/customer-portal-prd.md)).

## Risks

- Dependency on Supabase Auth's availability and roadmap — mitigated by JWT-based auth being a fairly standard pattern; a future migration to another provider is a bounded, if non-trivial, project.
- MFA enforcement (required for Owner/Admin — see [Authentication Security](../07-security/authentication-security.md)) depends on Supabase Auth's TOTP support remaining reliable and well-supported.

## Migration / Rollback

A future migration away from Supabase Auth would require re-issuing sessions for all existing Users (a coordinated cutover, not a live migration) and reimplementing the JWT verification middleware — bounded in scope since Atlas's own tables (`organization_memberships`, `roles`) don't depend on Supabase Auth-specific data beyond the `user_id` foreign key reference, which is preserved through a migration by mapping old to new identity IDs.

## Related Decisions

[ADR-005: Supabase](./ADR-005-supabase.md) · [ADR-007: Multi-Tenancy](./ADR-007-multi-tenancy.md) · [ADR-008: RBAC](./ADR-008-rbac.md) · [Authentication Security](../07-security/authentication-security.md)
