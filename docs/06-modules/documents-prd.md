# Documents — PRD

## 1. Purpose

Capture, store, and organize files (photos, signed forms, PDFs) attached to Jobs, Properties, and Assets. See [Documents](../03-domain/documents.md).

## 2. Business problem

Photo evidence and signed paperwork today live scattered across personal phones and paper files, unavailable when a dispute or warranty claim needs them, and lost entirely when a Technician leaves the company.

## 3. Goals

- Every job-relevant photo/form is captured in-app and permanently tied to the correct Job/Property/Asset.
- Fast mobile capture (camera → attached in two taps).
- Documents remain retrievable years later for warranty/compliance needs.

## 4. Non-goals

- Full document management (folders, sharing links, e-signature workflows beyond simple on-screen signature capture) — Atlas captures job-relevant documents, it is not a general DMS.

## 5. Personas

[Curtis (Technician)](../00-overview/user-personas.md) primarily (captures), [Maria (Owner)](../00-overview/user-personas.md)/[Priya (Accountant)](../00-overview/user-personas.md) (retrieve for disputes/records).

## 6. User stories

See [User Stories](../01-product/user-stories.md); plus: As a Technician, I want before/after photos to attach automatically to the Job's Task checklist, so I don't have to manually file them afterward.

## 7. Functional requirements

Capture/upload from mobile and web; categorize (photo before/after, signature, signed form); versioning on re-upload; attach to Job/Property/Asset.

## 8. Business rules

Full detail in [Documents](../03-domain/documents.md) — notably: the polymorphic attachment target is validated against the uploader's Organization; deletion is Admin/Owner-only and still audited.

## 9. State machines

None — Documents have a `version` sequence, not a status state machine.

## 10. Data requirements

`documents` — see [Schema Overview](../04-database/schema-overview.md); binary storage in Supabase Storage per [ADR-013](../11-adr/ADR-013-file-storage.md).

## 11. API requirements

`POST /api/v1/documents` (returns a signed upload URL, then a confirm-upload call), `GET /api/v1/{jobs|properties|assets}/{id}/documents`, `DELETE /api/v1/documents/{id}` (Admin/Owner only).

## 12. Permission requirements

Upload requires write access to the parent entity. Delete restricted to Admin/Owner. Read inherits parent visibility.

## 13. UI requirements

Camera-first mobile capture button on Task/Job screens; Document gallery on Job/Property/Asset detail pages; signature capture pad component.

## 14. Notifications

None directly.

## 15. Audit requirements

Upload, version replacement, and deletion each produce an [Audit Event](../03-domain/audit-events.md).

## 16. Error cases

Upload exceeding size/type limits (`422`, checked before a Storage signed URL is even issued — see [Request Validation](../05-api/request-validation.md)); attaching to an entity outside the uploader's Organization (`403`, structurally prevented by the validation described in [Documents](../03-domain/documents.md)).

## 17. Edge cases

A Technician captures a photo offline; it queues locally and uploads on reconnect (see [Mobile PRD](./mobile-prd.md)) — the Document row is created only once the actual upload succeeds, not optimistically, to avoid orphaned metadata referencing a file that never made it to Storage.

## 18. Acceptance criteria

**Given** a Technician re-uploads a corrected signed form, **when** staff view the Job's Documents, **then** both the original and corrected versions are visible and distinguishable by version/timestamp.

## 19. Testing requirements

Upload/download integration tests including size/type validation; polymorphic-attachment cross-tenant rejection test; mobile offline-queue-then-upload test.

## 20. Future extensions

OCR on nameplate photos to auto-populate Asset manufacturer/model/serial; e-signature workflows with legal-grade audit trail for larger contracts.
