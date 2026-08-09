/**
 * assets.md business rules 2/3 + assets-prd.md §9: an Asset's status is a
 * one-way lifecycle flag, not a full state machine — `active` is the only
 * non-terminal status, and it may transition to either `removed` or
 * `decommissioned`, both terminal. A replaced unit becomes a *new* Asset
 * record (business rule 3); this module only governs the status field of
 * a single existing Asset row.
 */

export type AssetStatus = 'active' | 'removed' | 'decommissioned';

export const TERMINAL_ASSET_STATUSES: readonly AssetStatus[] = ['removed', 'decommissioned'];

export function canTransitionAssetStatus(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return false;
  if (TERMINAL_ASSET_STATUSES.includes(from)) return false;
  return TERMINAL_ASSET_STATUSES.includes(to);
}
