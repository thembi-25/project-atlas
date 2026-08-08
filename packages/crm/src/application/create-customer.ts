import { withRequestContext, type DatabaseClient } from '@atlas/database';
import { deriveImplicitPrimaryContact } from '../domain/implicit-contact';
import { isPotentialDuplicate } from '../domain/duplicate-detection';
import {
  findPotentialDuplicateCustomers,
  insertCustomer,
  type Customer,
} from '../infrastructure/customers';
import { insertContact, type Contact } from '../infrastructure/contacts';
import { requireCustomersPermission } from './authorize';

export interface CreateCustomerParams {
  organizationId: string;
  actorUserId: string;
  type: 'residential' | 'commercial';
  displayName: string;
  billingAddressLine1?: string | undefined;
  billingAddressLine2?: string | undefined;
  billingAddressCity?: string | undefined;
  billingAddressRegion?: string | undefined;
  billingAddressPostalCode?: string | undefined;
  billingAddressCountry?: string | undefined;
  tags?: readonly string[] | undefined;
  notes?: string | undefined;
  portalAccessEnabled?: boolean | undefined;
  /**
   * customers-prd.md §7 quick-create flow: "name + phone/address only,
   * other fields optional." When omitted, an implicit primary Contact is
   * still created from `displayName` alone — contacts.md business rule 1
   * applies unconditionally, not just to explicit input.
   */
  primaryContact?:
    | {
        name?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
        roleTitle?: string | undefined;
      }
    | undefined;
}

export interface CreateCustomerResult {
  customer: Customer;
  primaryContact: Contact;
  /** customers-prd.md §7/§20: detected, never auto-merged — see domain/duplicate-detection.ts. */
  potentialDuplicates: Customer[];
}

export async function createCustomer(
  db: DatabaseClient,
  params: CreateCustomerParams,
): Promise<CreateCustomerResult> {
  return withRequestContext(db, params.actorUserId, async (tx) => {
    await requireCustomersPermission(tx, {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: 'write',
    });

    const customer = await insertCustomer(tx, {
      organizationId: params.organizationId,
      type: params.type,
      displayName: params.displayName,
      billingAddressLine1: params.billingAddressLine1,
      billingAddressLine2: params.billingAddressLine2,
      billingAddressCity: params.billingAddressCity,
      billingAddressRegion: params.billingAddressRegion,
      billingAddressPostalCode: params.billingAddressPostalCode,
      billingAddressCountry: params.billingAddressCountry,
      tags: params.tags,
      notes: params.notes,
      portalAccessEnabled: params.portalAccessEnabled,
    });

    const implicit = deriveImplicitPrimaryContact({
      displayName: params.primaryContact?.name ?? params.displayName,
      phone: params.primaryContact?.phone,
      email: params.primaryContact?.email,
    });
    const primaryContact = await insertContact(tx, {
      organizationId: params.organizationId,
      customerId: customer.id,
      name: implicit.name,
      phone: implicit.phone,
      email: implicit.email,
      roleTitle: params.primaryContact?.roleTitle,
      isPrimary: true,
    });

    const candidates = await findPotentialDuplicateCustomers(tx, params.organizationId, {
      displayName: params.displayName,
      phone: implicit.phone,
      email: implicit.email,
    });
    const potentialDuplicates = candidates
      .filter(
        (candidate) =>
          candidate.customer.id !== customer.id &&
          isPotentialDuplicate({
            matchedOnExactPhone: candidate.matchedOnExactPhone,
            matchedOnExactEmail: candidate.matchedOnExactEmail,
            displayNameSimilarity: candidate.displayNameSimilarity,
          }),
      )
      .map((candidate) => candidate.customer);

    return { customer, primaryContact, potentialDuplicates };
  });
}
