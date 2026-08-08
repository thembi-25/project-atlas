# Versioning

## Scheme

URL path versioning: `/api/v1/`. See [ADR-023: API Versioning](../11-adr/ADR-023-api-versioning.md) for the full rationale.

## What does NOT require a version bump

Additive, backward-compatible changes ship within `v1` without a new version:
- Adding a new optional request field.
- Adding a new field to a response payload (clients are expected to ignore unknown fields).
- Adding a new endpoint.
- Adding a new enum value to a field that clients are expected to treat as an open set (documented per field where applicable).
- Loosening a validation rule.

## What DOES require a new version (`/api/v2/`)

- Removing or renaming a response field.
- Changing a field's type or meaning.
- Removing an endpoint or tightening a previously-permissive validation rule in a way that would break existing valid requests.
- Changing default behavior (e.g., a different default sort) in a way that changes existing client behavior silently.

## Deprecation policy

When `/api/v2/` is introduced for a given resource, `/api/v1/` for that resource is supported for a minimum of 12 months in parallel, with deprecation clearly communicated (response header `Deprecation: true` plus a `Sunset` header with the planned removal date) before removal — this applies from the point Atlas has external (non-first-party) API consumers; prior to that, the same discipline is still followed internally to keep the practice consistent by the time it matters externally.

## Versioning is per-API, not per-resource

Atlas versions the whole `/api/v1/` surface as one unit rather than per-resource versioning (`/api/v1/jobs` vs. `/api/v2/customers` independently) — this keeps the mental model simple for integrators at the cost of occasionally shipping a new major version for a change that only affects one resource. This trade-off is revisited only if the API surface grows large enough that whole-surface versioning becomes a genuine deployment bottleneck.

## Related documents

[API Overview](./api-overview.md) · [ADR-023: API Versioning](../11-adr/ADR-023-api-versioning.md) · [Integrations](./integrations.md)
