import { describe, expect, it } from 'vitest';
import { deriveImplicitPrimaryContact } from './implicit-contact';

describe('implicit primary contact', () => {
  it('derives a primary Contact from the Customer display name alone', () => {
    const contact = deriveImplicitPrimaryContact({ displayName: 'Jane Doe' });
    expect(contact).toEqual({
      name: 'Jane Doe',
      phone: undefined,
      email: undefined,
      isPrimary: true,
    });
  });

  it('carries phone/email through when supplied', () => {
    const contact = deriveImplicitPrimaryContact({
      displayName: 'Jane Doe',
      phone: '555-0100',
      email: 'jane@example.com',
    });
    expect(contact.phone).toBe('555-0100');
    expect(contact.email).toBe('jane@example.com');
    expect(contact.isPrimary).toBe(true);
  });
});
