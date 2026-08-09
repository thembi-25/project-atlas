import { describe, expect, it } from 'vitest';
import { canTransitionAssetStatus } from './lifecycle';

describe('canTransitionAssetStatus', () => {
  it('allows active -> removed', () => {
    expect(canTransitionAssetStatus('active', 'removed')).toBe(true);
  });

  it('allows active -> decommissioned', () => {
    expect(canTransitionAssetStatus('active', 'decommissioned')).toBe(true);
  });

  it('rejects removed -> decommissioned (terminal)', () => {
    expect(canTransitionAssetStatus('removed', 'decommissioned')).toBe(false);
  });

  it('rejects decommissioned -> removed (terminal)', () => {
    expect(canTransitionAssetStatus('decommissioned', 'removed')).toBe(false);
  });

  it('rejects decommissioned -> active (no reactivation)', () => {
    expect(canTransitionAssetStatus('decommissioned', 'active')).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(canTransitionAssetStatus('active', 'active')).toBe(false);
  });
});
