import { handleImpersonateError } from '../../../src/lib/actions/impersonate';
import { response } from '../../../src/lib/utils/response';
import axios from 'axios';

const mockIsAxiosError = jest.spyOn(axios, 'isAxiosError');

describe('handleImpersonateError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user not found for 404 when registerOnMissing is false', () => {
    mockIsAxiosError.mockReturnValue(true);

    const errorResult = handleImpersonateError(
      { response: { status: 404, data: {} }, message: 'Not found' },
      false
    );
    const result = response(errorResult, errorResult.error);

    expect(result).toEqual({
      ok: false,
      token: null,
      user: null,
      error: 'User not found',
    });
  });

  it('should return JSON stringified error for non-404 axios errors', () => {
    mockIsAxiosError.mockReturnValue(true);

    const errorResult = handleImpersonateError(
      { response: { status: 400, data: { error: 'Invalid' } }, message: 'Bad request' },
      false
    );
    const result = response(errorResult, errorResult.error);

    expect(result.ok).toBe(false);
    expect(result.error).toBe(JSON.stringify({ error: 'Invalid' }));
    expect(result.token).toBeNull();
    expect(result.user).toBeNull();
  });

  it('should return error message for non-axios errors', () => {
    mockIsAxiosError.mockReturnValue(false);

    const errorResult1 = handleImpersonateError(new Error('Something went wrong'), false);
    const result1 = response(errorResult1, errorResult1.error);
    expect(result1.ok).toBe(false);
    expect(result1.error).toBe('Something went wrong');
    expect(result1.token).toBeNull();
    expect(result1.user).toBeNull();

    const errorResult2 = handleImpersonateError('String error', false);
    const result2 = response(errorResult2, errorResult2.error);
    expect(result2.ok).toBe(false);
    expect(result2.error).toBe('String error');
    expect(result2.token).toBeNull();
    expect(result2.user).toBeNull();
  });
});
