import { response } from '../../../src/lib/utils/response';

describe('response', () => {
  it('should return success response when errorMessage is null', () => {
    const result = response({ data: 'test', id: 123 }, null);

    expect(result.ok).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe('test');
    expect(result.id).toBe(123);
  });

  it('should return success response when errorMessage is omitted (defaults to null)', () => {
    const result = response({ data: 'test' });

    expect(result.ok).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe('test');
  });

  it('should return error response when errorMessage is provided', () => {
    const result = response({ data: 'test' }, 'Something went wrong');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Something went wrong');
    expect(result.data).toBe('test');
  });

  it('should preserve all payload properties in success response', () => {
    const payload = { a: 1, b: 'two', c: { nested: true } };
    const result = response(payload, null);

    expect(result).toEqual({ ...payload, ok: true, error: null });
  });

  it('should preserve all payload properties in error response', () => {
    const payload = { a: 1, b: 'two', c: { nested: true } };
    const result = response(payload, 'Error message');

    expect(result).toEqual({ ...payload, ok: false, error: 'Error message' });
  });

  it('should spread error details onto soft-fail payload', () => {
    const result = response(
      {},
      {
        message: 'User is blocked',
        details: {
          error: 'invalid_grant',
          error_description: 'User is blocked',
          error_code: 'blocked',
        },
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'User is blocked',
      error_description: 'User is blocked',
      error_code: 'blocked',
    });
  });
});
