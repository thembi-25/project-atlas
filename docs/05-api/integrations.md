# API Integrations (Inbound Third-Party Access)

## Purpose

This document covers how external parties integrate **against** Atlas's own API — distinct from [Integration Architecture](../02-architecture/integration-architecture.md), which covers how Atlas calls **out** to third parties like Stripe and Twilio.

## Launch scope

At launch, `/api/v1/` is consumed only by Atlas's own first-party web and mobile clients (see [ADR-010: API-First](../11-adr/ADR-010-api-first.md) for why it's still built as a proper versioned API rather than a private RPC layer, even though no external consumer exists yet). No public API documentation portal, no third-party developer onboarding flow, and no OAuth-for-third-party-apps flow ship at launch.

## Designed-for-but-not-built-yet: third-party and partner access

The API is designed so the following become additive, not architecture-changing, when their Roadmap Phase arrives:

- **Accounting tool integrations beyond QuickBooks Online** (e.g., Xero) — same `/api/v1/` surface, a new integration-specific client module (see [Integration Architecture](../02-architecture/integration-architecture.md)).
- **Zapier/automation-platform-style integration** — enabled by [API keys](./authentication.md#api-keys-for-third-partyfuture-integration-use) and [outbound webhooks](./webhooks.md#outbound-webhooks-future-documented-for-domain-completeness).
- **Supplier Marketplace partner APIs** (Strategic Phase 3) and **Manufacturer partner APIs** (Strategic Phase 4) — see [Marketplace PRD](../06-modules/marketplace-prd.md), [Manufacturers PRD](../06-modules/manufacturers-prd.md). These will likely need their own scoped API key types and Permission scopes (e.g., a Supplier's integration credential can create `marketplace_orders` but nothing else), building on the existing Permission model in [Permissions](../03-domain/permissions.md) rather than a parallel auth system.

## Principles for any future third-party access

1. A third-party integration never gets broader access than the Permissions of the Organization user who provisioned its API key.
2. Every third-party-initiated write produces the same [Audit Event](../03-domain/audit-events.md) trail as a first-party write, with `actor_type = 'api_key'` recorded.
3. Rate limits for API-key traffic are enforced per-Organization, independent of first-party session traffic (see [Rate Limiting](./rate-limiting.md)), so a misbehaving integration cannot degrade the Organization's own staff experience in the web app.

## Related documents

[Integration Architecture](../02-architecture/integration-architecture.md) · [Authentication](./authentication.md) · [Webhooks](./webhooks.md) · [Versioning](./versioning.md)
