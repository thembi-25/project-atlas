/**
 * CRM domain module — Customers & Contacts. See docs/13-roadmap/sprint-2.md,
 * docs/03-domain/customers.md, docs/03-domain/contacts.md,
 * docs/06-modules/crm-prd.md, docs/06-modules/customers-prd.md.
 *
 * Other packages/apps import only from here, never from
 * src/{domain,application,infrastructure}/* directly — see
 * docs/08-engineering/project-structure.md, "Rule: no cross-package deep
 * imports."
 */

// Domain
export {
  isPotentialDuplicate,
  DISPLAY_NAME_SIMILARITY_THRESHOLD,
  type DuplicateSignal,
} from './domain/duplicate-detection';
export { deriveImplicitPrimaryContact } from './domain/implicit-contact';
export type {
  ImplicitPrimaryContactInput,
  ImplicitPrimaryContact,
} from './domain/implicit-contact';
export {
  NotFoundError,
  ForbiddenError,
  CustomerHasActiveRecordsError,
  InvalidCustomerStateError,
} from './domain/errors';

// Application use cases
export { createCustomer } from './application/create-customer';
export type { CreateCustomerParams, CreateCustomerResult } from './application/create-customer';
export {
  getCustomer,
  listCustomers,
  searchCustomers,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
} from './application/manage-customer';
export type {
  GetCustomerParams,
  ListCustomersParams,
  SearchCustomersParams,
  UpdateCustomerParams,
  ArchiveCustomerParams,
  RestoreCustomerParams,
} from './application/manage-customer';
export {
  listContacts,
  getContact,
  createContact,
  updateContact,
  archiveContact,
  restoreContact,
} from './application/manage-contact';
export type {
  ListContactsParams,
  GetContactParams,
  CreateContactParams,
  UpdateContactParams,
  ArchiveContactParams,
  RestoreContactParams,
} from './application/manage-contact';

// Infrastructure types (read-only shapes useful to route handlers building responses)
export type {
  Customer,
  CustomerCursor,
  CustomerSortField,
  SortDirection,
  CustomerSearchHit,
} from './infrastructure/customers';
export type { Contact } from './infrastructure/contacts';
