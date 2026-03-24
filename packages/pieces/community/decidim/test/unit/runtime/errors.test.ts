import { z } from 'zod';
import { getErrorMessage } from '../../../src/lib/runtime/errors';

describe('getErrorMessage', () => {
  it('joins Zod issue messages', () => {
    const err = z.object({ a: z.string() }).safeParse({}).error;
    expect(err).toBeDefined();
    expect(getErrorMessage(err!)).toMatch(/string|Required/i);
  });

  it('uses Error.message for generic errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies unknown throws', () => {
    expect(getErrorMessage(404)).toBe('404');
  });
});
