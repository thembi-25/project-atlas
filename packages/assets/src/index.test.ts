import { describe, expect, it } from 'vitest';

describe('@atlas/assets scaffold', () => {
  it('is a valid, importable empty module (Sprint 0 placeholder)', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });
});
