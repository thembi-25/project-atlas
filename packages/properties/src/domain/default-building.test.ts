import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILDING_NAME, shouldProvisionDefaultBuilding } from './default-building';

describe('shouldProvisionDefaultBuilding', () => {
  it('provisions a default Building for a simple single-family residential Property', () => {
    expect(shouldProvisionDefaultBuilding('residential_single_family')).toBe(true);
  });

  it('does not auto-provision for a multi-unit residential Property', () => {
    expect(shouldProvisionDefaultBuilding('residential_multi_unit')).toBe(false);
  });

  it('does not auto-provision for a commercial Property', () => {
    expect(shouldProvisionDefaultBuilding('commercial')).toBe(false);
  });

  it('uses "Main House" as the default Building name', () => {
    expect(DEFAULT_BUILDING_NAME).toBe('Main House');
  });
});
