import type { Customer, Contact } from '@atlas/crm';

/** docs/05-api/resource-conventions.md: response JSON mirrors database column names (snake_case). */
export function serializeCustomer(customer: Customer) {
  return {
    id: customer.id,
    organization_id: customer.organizationId,
    type: customer.type,
    display_name: customer.displayName,
    billing_address_line1: customer.billingAddressLine1,
    billing_address_line2: customer.billingAddressLine2,
    billing_address_city: customer.billingAddressCity,
    billing_address_region: customer.billingAddressRegion,
    billing_address_postal_code: customer.billingAddressPostalCode,
    billing_address_country: customer.billingAddressCountry,
    tags: customer.tags,
    notes: customer.notes,
    portal_access_enabled: customer.portalAccessEnabled,
    deleted_at: customer.deletedAt ? customer.deletedAt.toISOString() : null,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
  };
}

export function serializeContact(contact: Contact) {
  return {
    id: contact.id,
    organization_id: contact.organizationId,
    customer_id: contact.customerId,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    role_title: contact.roleTitle,
    is_primary: contact.isPrimary,
    portal_access_enabled: contact.portalAccessEnabled,
    deleted_at: contact.deletedAt ? contact.deletedAt.toISOString() : null,
    created_at: contact.createdAt.toISOString(),
    updated_at: contact.updatedAt.toISOString(),
  };
}
