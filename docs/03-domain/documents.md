# Documents

## Purpose

A Document is a stored file — a job photo, a signed form/waiver, an invoice PDF, an asset manual — attached to a [Job](./jobs.md), [Property](./properties.md), or [Asset](./assets.md). Documents are how Atlas captures the visual/paper trail of work performed.

## Key attributes

- `file_url` (pointer into Supabase Storage, not the binary itself — see [ADR-013](../11-adr/ADR-013-file-storage.md)), `mime_type`, `size_bytes`.
- `category`: `photo_before`, `photo_after`, `signature`, `signed_form`, `invoice_pdf`, `estimate_pdf`, `other`.
- `attached_to_type` / `attached_to_id` (polymorphic reference to Job, Property, or Asset — see Business Rules for how this is constrained safely).
- `uploaded_by_user_id`, `uploaded_at`.
- `version` (for documents that get replaced, e.g., a re-signed form).

## Relationships

- **Attached to** exactly one of [Job](./jobs.md), [Property](./properties.md), or [Asset](./assets.md).
- **Produced by** a [Task](./tasks.md) of type `photo`/`signature`, or uploaded directly by a User.

## Business rules

1. The polymorphic `attached_to_type`/`attached_to_id` pair is constrained at the database layer (a `CHECK` constraint on `attached_to_type` plus application-layer validation that the referenced ID's `organization_id` matches) so a Document can never silently attach to a record outside the uploader's Organization — see [Constraints](../04-database/constraints.md).
2. Documents are versioned, not overwritten — re-uploading a signed form creates a new `version`, and prior versions remain retrievable, since a dispute over "what was actually signed" must be resolvable from history.
3. Documents are never deleted by a non-privileged user action; deletion (rare, e.g., accidental upload) is an Admin/Owner-only action that still leaves an [Audit Event](./audit-events.md) record even though the underlying file is removed from storage.
4. File uploads are validated for type and size at the API layer before a Storage signed URL is issued — see [Request Validation](../05-api/request-validation.md), [Secure File Handling](../07-security/data-protection.md).

## Data requirements

`documents` table: `organization_id`, `attached_to_type`, `attached_to_id`, `file_url`, `mime_type`, `size_bytes`, `category`, `uploaded_by_user_id`, `version`, `deleted_at`, timestamps.

## Permission requirements

Inherits visibility from the parent (Job/Property/Asset); upload requires write access to the parent entity.

## Related documents

[Documents PRD](../06-modules/documents-prd.md) · [ADR-013: File Storage](../11-adr/ADR-013-file-storage.md) · [Data Protection](../07-security/data-protection.md)
