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
  it('rethrows axios errors as AP piece errors with parseable fields', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const err = {
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          error: 'bad',
          error_description: 'Invalid request',
          error_details: [{ field: 'email', description: 'taken' }],
        },
      },
      config: { headers: { Authorization: 'Bearer secret' } },
    };
    try {
      rethrowAxiosError(err);
      expect.fail('expected throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).toMatchObject({
        __apErrorVersion: 1,
        message: 'Invalid request',
        status: 400,
        error: 'bad',
        error_description: 'Invalid request',
        error_details: [{ field: 'email', description: 'taken' }],
      });
      const roundTrip = JSON.parse(JSON.stringify(thrown));
      expect(roundTrip).toMatchObject({
        __apErrorVersion: 1,
        message: 'Invalid request',
        status: 400,
        error: 'bad',
        error_description: 'Invalid request',
        error_details: [{ field: 'email', description: 'taken' }],
      });
      expect(JSON.stringify(thrown)).not.toContain('Bearer secret');
    }
    spy.mockRestore();
  });

  it('defaults status to 500 when response status is missing', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const err = { message: 'Network Error' };
    try {
      rethrowAxiosError(err);
      expect.fail('expected throw');
    } catch (thrown) {
      expect(thrown).toMatchObject({
        __apErrorVersion: 1,
        message: 'Network Error',
        status: 500,
        error: 500,
        error_description: 'Network Error',
        error_details: [],
      });
      const roundTrip = JSON.parse(JSON.stringify(thrown));
      expect(roundTrip.error_details).toEqual([]);
      expect(roundTrip.error).toBe(500);
    }
    spy.mockRestore();
  });

  it('normalizes string response bodies', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const err = {
      message: 'Request failed',
      response: { status: 422, data: 'Unprocessable' },
    };
    try {
      rethrowAxiosError(err);
      expect.fail('expected throw');
    } catch (thrown) {
      expect(thrown).toMatchObject({
        __apErrorVersion: 1,
        message: 'Unprocessable',
        status: 422,
        error: 422,
        error_description: 'Unprocessable',
        error_details: [],
      });
    }
    spy.mockRestore();
  });

  it('does not throw for non-axios errors', () => {
    const spy = vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    expect(() => rethrowAxiosError(new Error('validation'))).not.toThrow();
    spy.mockRestore();
  });
});
