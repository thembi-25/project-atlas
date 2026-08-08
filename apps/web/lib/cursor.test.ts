import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, parseLimit } from './cursor';
import { AppError } from './errors';

describe('cursor pagination helpers', () => {
  it('round-trips a cursor through encode/decode', () => {
    const cursor = {
      sortValue: '2026-08-08T00:00:00.000Z',
      id: '01984f6e-1a2b-7c91-9e21-6a1f3d2b8c22',
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects a malformed cursor with a validation_error', () => {
    expect(() => decodeCursor('not-valid-base64url-json')).toThrow(AppError);
    try {
      decodeCursor('not-valid-base64url-json');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('validation_error');
    }
  });

  it('rejects a cursor missing required fields', () => {
    const badToken = Buffer.from(JSON.stringify({ sortValue: 'x' }), 'utf8').toString('base64url');
    expect(() => decodeCursor(badToken)).toThrow(AppError);
  });

  describe('parseLimit', () => {
    it('defaults to 25 when no limit is given', () => {
      expect(parseLimit(null)).toBe(25);
    });

    it('caps at 100', () => {
      expect(parseLimit('500')).toBe(100);
    });

    it('accepts a valid positive integer', () => {
      expect(parseLimit('10')).toBe(10);
    });

    it('rejects a non-integer', () => {
      expect(() => parseLimit('abc')).toThrow(AppError);
    });

    it('rejects zero or negative values', () => {
      expect(() => parseLimit('0')).toThrow(AppError);
      expect(() => parseLimit('-5')).toThrow(AppError);
    });
  });
});
