import { handleImpersonateError, impersonate } from '../../../src/lib/actions/impersonate';
import { response } from '../../../src/lib/utils/response';
import axios from 'axios';
import { OAuthApi } from '@octree/decidim-sdk';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import * as systemAccessTokenModule from '../../../src/lib/utils/systemAccessToken';
import * as introspectTokenModule from '../../../src/lib/utils/introspecToken';

jest.mock('@octree/decidim-sdk', () => {
  const actual = jest.requireActual('@octree/decidim-sdk');
  return {
    ...actual,
    OAuthApi: jest.fn(),
  };
});

jest.mock('../../../src/lib/utils/systemAccessToken');
jest.mock('../../../src/lib/utils/introspecToken');

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

describe('impersonate validation', () => {
  const mockOAuthApi = {
    createToken: jest.fn(),
  } as unknown as OAuthApi;

  const mockAuth = {
    baseUrl: 'https://example.decidim.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  const createContext = (propsValue: {
    username: string;
    fetchUserInfo?: boolean;
    registerOnMissing?: boolean;
    registrationOptions?: {
      userFullName?: string;
      sendConfirmationEmailOnRegister?: boolean;
    };
  }) => createMockActionContext({
    auth: mockAuth,
    propsValue,
    step: { name: 'impersonate' },
  }) as Parameters<typeof impersonate.run>[0];

  beforeEach(() => {
    jest.clearAllMocks();
    (OAuthApi as jest.Mock).mockImplementation(() => mockOAuthApi);
  });

  it('should throw validation error when username is too short', async () => {
    await expect(
      impersonate.run(createContext({ username: '1234' }))
    ).rejects.toThrow('Username must be at least 5 characters long');
  });

  it('should throw validation error when username is empty string', async () => {
    await expect(
      impersonate.run(createContext({ username: '' }))
    ).rejects.toThrow('Username is required');
  });

  it('should throw validation error when username is missing', async () => {
    await expect(
      impersonate.run(createContext({ username: undefined as any }))
    ).rejects.toThrow('Username is required');
  });

  it('should throw validation error when registrationOptions.userFullName is too short', async () => {
    await expect(
      impersonate.run(createContext({
        username: 'validuser',
        registerOnMissing: true,
        registrationOptions: { userFullName: 'John' },
      }))
    ).rejects.toThrow('User Full Name must be at least 5 characters long');
  });

  it('should throw validation error when registrationOptions.userFullName is empty string', async () => {
    await expect(
      impersonate.run(createContext({
        username: 'validuser',
        registerOnMissing: true,
        registrationOptions: { userFullName: '' },
      }))
    ).rejects.toThrow('User Full Name must be at least 5 characters long');
  });
});
