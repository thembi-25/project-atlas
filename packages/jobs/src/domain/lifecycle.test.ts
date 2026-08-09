import { describe, expect, it } from 'vitest';
import { canTransitionJobStatus, isTerminalJobStatus, JOB_STATUSES } from './lifecycle';

describe('canTransitionJobStatus', () => {
  it.each([
    ['draft', 'scheduled'],
    ['draft', 'cancelled'],
    ['scheduled', 'dispatched'],
    ['scheduled', 'cancelled'],
    ['dispatched', 'in_progress'],
    ['dispatched', 'cancelled'],
    ['in_progress', 'on_hold'],
    ['in_progress', 'completed'],
    ['on_hold', 'in_progress'],
    ['on_hold', 'cancelled'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionJobStatus(from, to)).toBe(true);
  });

  it.each([
    ['draft', 'dispatched'],
    ['draft', 'in_progress'],
    ['draft', 'completed'],
    ['scheduled', 'draft'],
    ['scheduled', 'in_progress'],
    ['scheduled', 'completed'],
    ['dispatched', 'draft'],
    ['dispatched', 'scheduled'],
    ['dispatched', 'completed'],
    ['in_progress', 'draft'],
    ['in_progress', 'scheduled'],
    ['in_progress', 'dispatched'],
    ['in_progress', 'cancelled'],
    ['on_hold', 'draft'],
    ['on_hold', 'completed'],
  ] as const)('rejects %s -> %s (undocumented edge)', (from, to) => {
    expect(canTransitionJobStatus(from, to)).toBe(false);
  });

  it('rejects a no-op transition (status to itself) for every status', () => {
    for (const status of JOB_STATUSES) {
      expect(canTransitionJobStatus(status, status)).toBe(false);
    }
  });

  it('rejects every transition out of both terminal states', () => {
    for (const status of JOB_STATUSES) {
      expect(canTransitionJobStatus('completed', status)).toBe(false);
      expect(canTransitionJobStatus('cancelled', status)).toBe(false);
    }
  });
});

describe('isTerminalJobStatus', () => {
  it('treats only completed and cancelled as terminal', () => {
    expect(isTerminalJobStatus('completed')).toBe(true);
    expect(isTerminalJobStatus('cancelled')).toBe(true);
    expect(isTerminalJobStatus('draft')).toBe(false);
    expect(isTerminalJobStatus('scheduled')).toBe(false);
    expect(isTerminalJobStatus('dispatched')).toBe(false);
    expect(isTerminalJobStatus('in_progress')).toBe(false);
    expect(isTerminalJobStatus('on_hold')).toBe(false);
  });
});
