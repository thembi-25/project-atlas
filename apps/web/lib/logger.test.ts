import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoggerForTests } from './logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('emits well-formed JSON with the expected fields', () => {
    const logger = createLoggerForTests();
    logger.info('hello', { requestId: 'req-1' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello');
    expect(parsed.requestId).toBe('req-1');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('routes warn and error levels to console.error, not console.log', () => {
    const logger = createLoggerForTests();
    logger.warn('careful');
    logger.error('broken');

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('redacts secret-shaped context keys', () => {
    const logger = createLoggerForTests();
    logger.info('login attempt', { apiKey: 'sk_live_should_not_leak', userId: 'user-1' });

    const parsed = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(parsed.apiKey).toBe('[REDACTED]');
    expect(parsed.userId).toBe('user-1');
  });

  it('respects the configured minimum level', () => {
    const logger = createLoggerForTests('warn');
    logger.debug('too quiet');
    logger.info('still too quiet');
    logger.warn('loud enough');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('child() merges bindings without mutating the parent logger', () => {
    const parent = createLoggerForTests();
    const child = parent.child({ requestId: 'req-42' });

    child.info('scoped message');
    const parsed = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(parsed.requestId).toBe('req-42');

    logSpy.mockClear();
    parent.info('unscoped message');
    const parentParsed = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(parentParsed.requestId).toBeUndefined();
  });
});
