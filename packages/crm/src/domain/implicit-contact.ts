/**
 * docs/03-domain/contacts.md business rule 1: "Every Customer has at
 * least one Contact; for a residential Customer created without
 * explicitly adding a Contact, the system creates an implicit primary
 * Contact from the Customer's own name/phone/email at creation time" —
 * applied unconditionally (not just residential) so downstream
 * notification/portal logic never has to special-case a contact-less
 * Customer. `customers` itself has no phone/email columns (business rule
 * 2 — that data always lives on a Contact), so "the Customer's own
 * name/phone/email" at creation time is exactly the quick-create
 * payload's own fields when no explicit Contact is supplied.
 */

export interface ImplicitPrimaryContactInput {
  displayName: string;
  phone?: string | undefined;
  email?: string | undefined;
}

export interface ImplicitPrimaryContact {
  name: string;
  phone: string | undefined;
  email: string | undefined;
  isPrimary: true;
}

export function deriveImplicitPrimaryContact(
  input: ImplicitPrimaryContactInput,
): ImplicitPrimaryContact {
  return {
    name: input.displayName,
    phone: input.phone,
    email: input.email,
    isPrimary: true,
  };
}
