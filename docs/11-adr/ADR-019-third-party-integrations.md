# ADR-019: Third-Party Integration Isolation Pattern

## Status

Accepted

## Date

2026-08-08

## Context

Atlas integrates with several external systems (Stripe, Twilio, Resend, QuickBooks Online, and future Marketplace/Manufacturer partners — see [Integration Architecture](../02-architecture/integration-architecture.md)). Without a consistent pattern, each integration risks being implemented differently, making the codebase harder to reason about and harder to test.

## Problem

How should third-party integrations be structured within the codebase so they're consistently testable, replaceable, and don't leak vendor-specific concerns into domain/application logic?

## Decision

Every third-party integration is isolated behind a **typed client module in `packages/integrations/<provider>`**, called only from Application/Infrastructure-layer code, never directly from Domain logic or Presentation components — consistent with [Architecture Principles](../02-architecture/architecture-principles.md). Non-critical-path integrations (email, SMS, accounting sync) are invoked asynchronously via the [Background Worker](../02-architecture/container-architecture.md); critical-path integrations (payment capture) may be synchronous but must be idempotent.

## Alternatives Considered

1. **Calling third-party SDKs directly from route handlers/domain logic wherever needed** — rejected. Scatters vendor-specific error handling and types throughout the codebase, makes swapping a provider (see [ADR-017](./ADR-017-notifications.md), Stripe alternatives in [ADR-018](./ADR-018-payments.md)) require touching many call sites, and makes unit-testing domain logic dependent on mocking vendor SDKs inconsistently.
2. **A generic, abstracted "integration interface" layer designed to support swapping any provider seamlessly** — rejected as premature over-abstraction; per the project's engineering philosophy, an abstraction is introduced once a second real implementation is needed, not speculatively. Each integration gets a clean, typed client — but not a forced common interface across fundamentally different providers (Stripe and Twilio don't need to look the same).

## Consequences

- Domain-layer code (e.g., `financials` module business logic) has zero direct dependency on the Stripe SDK — it calls an application-layer use case, which calls the isolated Stripe client.
- Each integration's tests mock only that integration's own typed client, not a shared abstraction, keeping test setup direct and specific.
- New integrations (Marketplace/Manufacturer partners in later phases) follow this same established pattern rather than each reinventing an approach.

## Risks

- Without active code-review discipline, a developer could bypass the pattern and call a vendor SDK directly "just this once" — mitigated by import-boundary lint rules (see [Coding Standards](../08-engineering/coding-standards.md)) restricting which packages may import third-party SDK packages directly.

## Migration / Rollback

Not applicable as a reversible decision — this is an ongoing code-organization discipline rather than an infrastructure choice. Any individual integration can be swapped by reimplementing its isolated client module, which is the entire point of the pattern.

## Related Decisions

[Integration Architecture](../02-architecture/integration-architecture.md) · [ADR-017: Notifications](./ADR-017-notifications.md) · [ADR-018: Payments](./ADR-018-payments.md) · [Project Structure](../08-engineering/project-structure.md)
