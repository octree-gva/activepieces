import { z } from 'zod';
import axios from 'axios';
import { vi } from 'vitest';
import { getErrorMessage, rethrowAxiosError } from '../../../src/lib/runtime/errors';

describe('getErrorMessage', () => {
  it('joins Zod issue messages', () => {
    const err = z.object({ a: z.string() }).safeParse({}).error;
    expect(err).toBeDefined();
    expect(getErrorMessage(err!).message).toMatch(/string|Required/i);
  });

  it('uses Error.message for generic errors', () => {
    expect(getErrorMessage(new Error('boom'))).toEqual({ message: 'boom' });
  });

  it('stringifies unknown throws', () => {
    expect(getErrorMessage(404)).toEqual({ message: '404' });
  });

  it('exposes axios object body fields without JSON.stringify', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const info = getErrorMessage({
      message: 'Request failed',
      response: {
        data: {
          error: 'invalid_grant',
          error_description: 'User is blocked',
          error_code: 'blocked',
        },
      },
    });

    expect(info).toEqual({
      message: 'User is blocked',
      details: {
        error: 'invalid_grant',
        error_description: 'User is blocked',
        error_code: 'blocked',
      },
    });

    spy.mockRestore();
  });
});

describe('rethrowAxiosError', () => {
  it('rethrows axios errors', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const err = { message: 'Request failed', response: { status: 400 } };
    expect(() => rethrowAxiosError(err)).toThrow();
    try {
      rethrowAxiosError(err);
    } catch (thrown) {
      expect(thrown).toBe(err);
    }
    spy.mockRestore();
  });

  it('does not throw for non-axios errors', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    expect(() => rethrowAxiosError(new Error('validation'))).not.toThrow();
    spy.mockRestore();
  });
});
