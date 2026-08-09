/**
 * buildings.md business rule 1: "Every Property has at least one
 * Building; a simple residential Property is provisioned with a single
 * default Building ('Main House') automatically at Property creation, so
 * Assets and Rooms always have a consistent parent regardless of Property
 * complexity — staff never need to think about Buildings for a simple
 * single-family home." "Simple residential" is read as
 * `residential_single_family` specifically: buildings.md's own Purpose
 * section distinguishes it from `residential_multi_unit` and `commercial`
 * Properties, which "may have several [Buildings]" and are expected to be
 * set up explicitly (e.g., "Unit 3B") rather than defaulted.
 */

import type { PropertyType } from '../infrastructure/properties';

export const DEFAULT_BUILDING_NAME = 'Main House';

export function shouldProvisionDefaultBuilding(propertyType: PropertyType): boolean {
  return propertyType === 'residential_single_family';
}
