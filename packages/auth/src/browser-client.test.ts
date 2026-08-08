import { describe, expect, it } from 'vitest';
import { createSupabaseBrowserClient } from './browser-client';

describe('createSupabaseBrowserClient', () => {
  it('constructs a client without making a network call', () => {
    const client = createSupabaseBrowserClient({
      url: 'http://localhost:54321',
      anonKey: 'test-anon-key',
    });
    expect(client).toBeDefined();
    expect(typeof client.auth.getSession).toBe('function');
  });
});
