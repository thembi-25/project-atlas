# Assets — PRD

## 1. Purpose

Manage Assets — the tracked pieces of equipment at a Property — including creation, location, and lifecycle history. See [Assets](../03-domain/assets.md).

## 2. Business problem

Technicians routinely arrive at a return-visit Property with no idea what equipment is installed, its age, or its service history, leading to wasted diagnostic time and, occasionally, quoting a replacement for equipment that's still under warranty.

## 3. Goals

- Every significant piece of installed equipment is recorded with enough detail (type, manufacturer, model, serial, install date) to be useful on a future visit.
- Asset history (every linked Job) is complete and permanent.
- Recording an Asset is fast enough that Technicians actually do it in the field, not just office staff during data entry.

## 4. Non-goals

- IoT/telemetry integration (real-time equipment monitoring) — future extension, not launch scope.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) primarily (creates/updates most Assets in the field).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As a Technician, I want to record a new Asset in under a minute while on-site, including a photo of the nameplate, so the data capture doesn't slow down the job.

## 7. Functional requirements

CRUD for Assets; photo-based nameplate capture (creates a linked [Document](../03-domain/documents.md)); mark Asset removed/decommissioned when replaced; service-history read.

## 8. Business rules

Full detail in [Assets](../03-domain/assets.md) — notably: a replaced unit becomes a new Asset record with the old one marked `removed`/`decommissioned`, never mutated in place.

## 9. State machines

Asset status: `active` → `removed`/`decommissioned` (terminal, but record remains visible in history — not a full state machine, a one-way lifecycle flag).

## 10. Data requirements

`asset_types`, `assets` — see [Schema Overview](../04-database/schema-overview.md).

## 11. API requirements

`GET/POST/PATCH/DELETE /api/v1/assets`, `GET /api/v1/assets/{id}/history`, `POST /api/v1/assets/{id}/decommission`.

## 12. Permission requirements

Same as parent [Property](./properties-prd.md) — Technicians can create/update Assets on Properties tied to their assigned Jobs.

## 13. UI requirements

Asset list on the Property detail page, grouped by Building/Room; Asset detail page with manufacturer/model/serial, install date, linked Warranties, and Job history; mobile-optimized quick-add flow with camera capture.

## 14. Notifications

None directly; Warranty-expiration notifications are covered in [Warranties PRD](./warranties-prd.md).

## 15. Audit requirements

All Asset create/update/decommission actions produce [Audit Events](../03-domain/audit-events.md).

## 16. Error cases

Attempting to decommission an Asset that's referenced by an in-progress Job (`409` — must complete or reassign the Job first, since the Job's context depends on the Asset's current status).

## 17. Edge cases

An Asset installed by a different Organization (customer switched service providers) with unknown install date/history — staff record what's knowable (type, manufacturer, model, serial) and mark install date/source Job as unknown rather than guessing, keeping the record honest.

## 18. Acceptance criteria

**Given** a Technician replacing a failed water heater, **when** they complete the replacement flow, **then** the old Asset is marked `removed` with an end date, and a new Asset record is created and linked to the new install Job, both visible in the Property's Asset history.

## 19. Testing requirements

Integration tests for the replace-Asset flow (old marked removed, new created, both retained); mobile end-to-end test for the quick-add-with-photo flow.

## 20. Future extensions

IoT telemetry integration; predicted remaining-lifespan estimates (Phase 3); barcode/QR nameplate scanning for faster data capture.
