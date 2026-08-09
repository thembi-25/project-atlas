import { describe, expect, it } from 'vitest';
import { windowsOverlap } from './conflict-detection';

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

describe('windowsOverlap', () => {
  it('detects a fully overlapping window', () => {
    expect(windowsOverlap(at(9), at(11), at(10), at(12))).toBe(true);
  });

  it('detects one window entirely inside another', () => {
    expect(windowsOverlap(at(9), at(17), at(10), at(11))).toBe(true);
  });

  it('detects identical windows', () => {
    expect(windowsOverlap(at(9), at(11), at(9), at(11))).toBe(true);
  });

  it('does not flag back-to-back windows as a conflict (end == start)', () => {
    expect(windowsOverlap(at(9), at(11), at(11), at(13))).toBe(false);
    expect(windowsOverlap(at(11), at(13), at(9), at(11))).toBe(false);
  });

  it('does not flag clearly separate windows', () => {
    expect(windowsOverlap(at(9), at(10), at(14), at(15))).toBe(false);
  });

  it('detects a one-minute overlap at the edge', () => {
    expect(windowsOverlap(at(9), at(11, 1), at(11), at(12))).toBe(true);
  });
});
