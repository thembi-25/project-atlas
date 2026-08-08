import { describe, expect, it } from 'vitest';
import { AppError, toAppError, toApiErrorBody } from './errors';

describe('AppError', () => {
  it('maps each documented code to its exact HTTP status', () => {
    expect(new AppError('bad_request', 'x').status).toBe(400);
    expect(new AppError('unauthenticated', 'x').status).toBe(401);
    expect(new AppError('forbidden', 'x').status).toBe(403);
    expect(new AppError('not_found', 'x').status).toBe(404);
    expect(new AppError('conflict', 'x').status).toBe(409);
    expect(new AppError('validation_error', 'x').status).toBe(422);
    expect(new AppError('rate_limited', 'x').status).toBe(429);
    expect(new AppError('internal_error', 'x').status).toBe(500);
    expect(new AppError('service_unavailable', 'x').status).toBe(503);
  });
});

describe('toApiErrorBody', () => {
  it('returns the documented envelope shape', () => {
    const error = new AppError('validation_error', 'Bad input', [
      { field: 'customer_id', issue: 'Required.' },
    ]);
    const body = toApiErrorBody(error, false);
    expect(body).toEqual({
      error: {
        code: 'validation_error',
        message: 'Bad input',
        details: [{ field: 'customer_id', issue: 'Required.' }],
      },
    });
  });

  it('never leaks the real internal_error message in production', () => {
    const error = new AppError(
      'internal_error',
      'Connection refused at postgres://internal-host:5432 with password hunter2',
    );
    const body = toApiErrorBody(error, true);
    expect(body.error.message).not.toContain('hunter2');
    expect(body.error.message).not.toContain('postgres://');
    expect(body.error.message).toBe(
      'An unexpected error occurred. Please try again or contact support.',
    );
  });

  it('shows the real internal_error message outside production for debuggability', () => {
    const error = new AppError('internal_error', 'Specific dev-only detail');
    const body = toApiErrorBody(error, false);
    expect(body.error.message).toBe('Specific dev-only detail');
  });

  it('omits the details field entirely when there are no details', () => {
    const error = new AppError('not_found', 'No job was found with the given ID.');
    const body = toApiErrorBody(error, false);
    expect(body.error).not.toHaveProperty('details');
  });
});

describe('toAppError', () => {
  it('passes an existing AppError through unchanged', () => {
    const original = new AppError('forbidden', 'nope');
    expect(toAppError(original)).toBe(original);
  });

  it('wraps a plain Error as an internal_error', () => {
    const wrapped = toAppError(new Error('boom'));
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.code).toBe('internal_error');
    expect(wrapped.message).toBe('boom');
  });

  it('wraps a non-Error thrown value safely', () => {
    const wrapped = toAppError('a string was thrown');
    expect(wrapped.code).toBe('internal_error');
  });
});
