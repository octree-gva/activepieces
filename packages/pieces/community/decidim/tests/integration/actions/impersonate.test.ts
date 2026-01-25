import { impersonate } from '../../../src/lib/actions/impersonate';
import { OAuthApi } from '@octree/decidim-sdk';
import { DecidimAccessToken } from '../../../src/types';
import { Response } from '../../../src/lib/utils/response';
import axios from 'axios';
import * as systemAccessTokenModule from '../../../src/lib/utils/systemAccessToken';
import * as introspectTokenModule from '../../../src/lib/utils/introspecToken';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { AppConnectionType } from '@activepieces/shared';

jest.mock('@octree/decidim-sdk', () => {
  const actual = jest.requireActual('@octree/decidim-sdk');
  return {
    ...actual,
    OAuthApi: jest.fn(),
  };
});

jest.mock('../../../src/lib/utils/systemAccessToken');
jest.mock('../../../src/lib/utils/introspecToken');

type ImpersonateResult = Response<{ token: DecidimAccessToken | null; user: any }>;

const mockOAuthApi = {
  createToken: jest.fn(),
} as unknown as OAuthApi;

const mockAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    baseUrl: 'https://example.decidim.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
} as const;

const mockAccessToken: DecidimAccessToken = {
  access_token: 'test-access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'oauth',
  created_at: Date.now(),
};

const createContext = (propsValue: {
  username: string;
  fetchUserInfo?: boolean;
  registerOnMissing?: boolean;
  registrationOptions?: {
    userFullName?: string;
    sendConfirmationEmailOnRegister?: boolean;
  };
}): Parameters<typeof impersonate.run>[0] => createMockActionContext({
  auth: mockAuth,
  propsValue,
  step: { name: 'impersonate' },
}) as Parameters<typeof impersonate.run>[0];

describe('Impersonate Action Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (OAuthApi as jest.Mock).mockImplementation(() => mockOAuthApi);
    jest.spyOn(axios, 'isAxiosError').mockRestore();
  });

  describe('Successful impersonation', () => {
    it('should return token without user info when fetchUserInfo is false', async () => {
      (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: mockAccessToken });

      const result = await impersonate.run(createContext({
        username: 'testuser',
        fetchUserInfo: false,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result).toEqual({
        ok: true,
        error: null,
        token: mockAccessToken,
        user: null,
      });
    });

    it('should return token and user info when fetchUserInfo is true', async () => {
      const mockUserResource = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
      const mockIntrospectResponse = {
        active: true,
        sub: 'user-123',
        aud: 'test-aud',
        resource: mockUserResource,
      };

      (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: mockAccessToken });
      jest.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
      jest.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue(mockIntrospectResponse as any);

      const result = await impersonate.run(createContext({
        username: 'testuser',
        fetchUserInfo: true,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result).toEqual({
        ok: true,
        error: null,
        token: mockAccessToken,
        user: mockUserResource,
      });
    });

    it('should register user with full name and confirmation email', async () => {
      (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: mockAccessToken });

      const result = await impersonate.run(createContext({
        username: 'newuser',
        fetchUserInfo: false,
        registerOnMissing: true,
        registrationOptions: {
          userFullName: 'New User',
          sendConfirmationEmailOnRegister: true,
        },
      })) as ImpersonateResult;

      expect(result.ok).toBe(true);
      expect(mockOAuthApi.createToken).toHaveBeenCalledWith({
        oauthGrantParam: expect.objectContaining({
          username: 'newuser',
          meta: expect.objectContaining({
            register_on_missing: true,
            skip_confirmation_on_register: false,
            name: 'New User',
          }),
        }),
      });
    });

    it('should register user without confirmation email', async () => {
      (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: mockAccessToken });

      const result = await impersonate.run(createContext({
        username: 'newuser',
        fetchUserInfo: false,
        registerOnMissing: true,
        registrationOptions: {
          userFullName: 'New User',
          sendConfirmationEmailOnRegister: false,
        },
      })) as ImpersonateResult;

      expect(result.ok).toBe(true);
      expect(mockOAuthApi.createToken).toHaveBeenCalledWith({
        oauthGrantParam: expect.objectContaining({
          meta: expect.objectContaining({
            skip_confirmation_on_register: true,
          }),
        }),
      });
    });
  });

  describe('Error handling', () => {
    it('should return user not found error for 404 when registerOnMissing is false', async () => {
      const axiosError = {
        response: { status: 404, data: { error: 'User not found' } },
        message: 'Not found',
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      (mockOAuthApi.createToken as jest.Mock).mockRejectedValue(axiosError);

      const result = await impersonate.run(createContext({
        username: 'nonexistent',
        fetchUserInfo: false,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result).toEqual({
        ok: false,
        error: 'User not found',
        token: null,
        user: null,
      });
    });

    it('should return error details for non-404 axios errors', async () => {
      const axiosError = {
        response: { status: 400, data: { error: 'Invalid request' } },
        message: 'Bad request',
      };

      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      (mockOAuthApi.createToken as jest.Mock).mockRejectedValue(axiosError);

      const result = await impersonate.run(createContext({
        username: 'testuser',
        fetchUserInfo: false,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result.ok).toBe(false);
      expect(result.error).toBe(JSON.stringify({ error: 'Invalid request' }));
      expect(result.token).toBeNull();
      expect(result.user).toBeNull();
    });

    it('should handle non-axios errors', async () => {
      const error = new Error('Network error');
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
      (mockOAuthApi.createToken as jest.Mock).mockRejectedValue(error);

      const result = await impersonate.run(createContext({
        username: 'testuser',
        fetchUserInfo: false,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.token).toBeNull();
      expect(result.user).toBeNull();
    });

    it('should return error when user token is inactive', async () => {
      (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: mockAccessToken });
      jest.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
      jest.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue(null);

      const result = await impersonate.run(createContext({
        username: 'testuser',
        fetchUserInfo: true,
        registerOnMissing: false,
      })) as ImpersonateResult;

      expect(result).toEqual({
        ok: false,
        error: 'User not active',
        token: null,
        user: null,
      });
    });
  });
});
