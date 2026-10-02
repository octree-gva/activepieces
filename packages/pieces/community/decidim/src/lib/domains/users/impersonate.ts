import {
  createAction,
  InputPropertyMap,
  Property,
} from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import {
  OAuthApi,
  PasswordGrantImpersonate,
  PasswordGrantImpersonateAuthTypeEnum,
  PasswordGrantImpersonateGrantTypeEnum,
  PasswordGrantImpersonateScopeEnum,
  ResourceDetails,
} from '@octree/decidim-sdk';
import { DecidimAccessToken } from '../../../types';
import axios from 'axios';
import {
  hostProp,
  usernameProp,
  fetchUserInfoProp,
  registerOnMissingProp,
  userFullNameProp,
  sendConfirmationEmailOnRegisterProp,
} from '../../props';
import { systemAccessToken } from '../../utils/systemAccessToken';
import { introspectToken } from '../../utils/introspecToken';
import { configuration } from '../../utils/configuration';
import { decidimAccessTokenFromResponse } from '../../runtime/sdk-casts';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { getErrorMessage } from '../../runtime/errors';

export interface RegistrationOptions {
  userFullName?: string;
  email?: string;
  sendConfirmationEmailOnRegister?: boolean;
}

export interface ImpersonateProps {
  username: string;
  fetchUserInfo?: boolean;
  registerOnMissing?: boolean;
  registrationOptions?: RegistrationOptions;
}

export function buildOAuthGrantParam(
  username: string,
  clientId: string,
  clientSecret: string,
  registerOnMissing: boolean,
  registrationOptions: RegistrationOptions
): PasswordGrantImpersonate {
  return {
    grant_type: PasswordGrantImpersonateGrantTypeEnum.Password,
    auth_type: PasswordGrantImpersonateAuthTypeEnum.Impersonate,
    username,
    meta: {
      register_on_missing: registerOnMissing,
      skip_confirmation_on_register: !registrationOptions.sendConfirmationEmailOnRegister,
      name: registrationOptions.userFullName || undefined,
      email: registrationOptions.email || undefined,
    },
    scope: PasswordGrantImpersonateScopeEnum.Oauth,
    client_id: clientId,
    client_secret: clientSecret,
  };
}

export async function createImpersonateToken(
  oauthApi: OAuthApi,
  oauthGrantParam: PasswordGrantImpersonate
): Promise<DecidimAccessToken> {
  const tokenResponse = await oauthApi.createToken({ oauthGrantParam });
  return decidimAccessTokenFromResponse(tokenResponse.data);
}

export async function fetchUserInfoIfNeeded(
  oauthApi: OAuthApi,
  accessToken: DecidimAccessToken,
  fetchUserInfo: boolean,
  clientId: string,
  clientSecret: string
): Promise<{ token: DecidimAccessToken; user: ResourceDetails | null } | null> {
  if (!fetchUserInfo) {
    return { token: accessToken, user: null };
  }

  const systemAccessTokenValue = await systemAccessToken(oauthApi, clientId, clientSecret);
  const userResponse = await introspectToken(
    oauthApi,
    accessToken.access_token,
    systemAccessTokenValue
  );

  if (!userResponse) {
    return null;
  }

  return { token: accessToken, user: userResponse.resource || null };
}

export function handleImpersonateError(
  error: unknown,
  registerOnMissing: boolean
): { token: null; user: null; error: string } & Record<string, unknown> {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404 && !registerOnMissing) {
      return { token: null, user: null, error: 'User not found' };
    }
  }
  const { message, details } = getErrorMessage(error);
  return { token: null, user: null, ...(details ?? {}), error: message };
}

export const impersonate = createAction({
  name: 'impersonate',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Impersonate',
  description: 'Get an access token to do action as a participant',

  props: {
    host: hostProp(),
    username: usernameProp(true),
    fetchUserInfo: fetchUserInfoProp(false),
    registerOnMissing: registerOnMissingProp(false),
    registrationOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Registration Options',
      description: 'Options for user registration',
      required: false,
      refreshers: ['registerOnMissing', 'auth'],
      props: async ({
        registerOnMissing,
        auth,
      }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (!registerOnMissing || registerOnMissing === false) {
          return {};
        }
        return {
          userFullName: userFullNameProp(false),
          sendConfirmationEmailOnRegister: sendConfirmationEmailOnRegisterProp(false),
        };
      },
    }),
  },
  async run(context) {
    assertProp(context.propsValue.username, 'Username is required');
    await propsValidation.validateZod(context.propsValue, {
      username: z.string().min(5, 'Username must be at least 5 characters long'),
      fetchUserInfo: z.boolean().optional(),
      registerOnMissing: z.boolean().optional(),
      registrationOptions: z
        .object({
          userFullName: z
            .string()
            .min(5, 'User Full Name must be at least 5 characters long')
            .optional(),
          sendConfirmationEmailOnRegister: z.boolean().optional(),
        })
        .optional(),
    });

    const { baseUrl, clientId, clientSecret } = extractAuth(context);
    const fetchUserInfo = context.propsValue.fetchUserInfo || false;
    const registerOnMissing = context.propsValue.registerOnMissing || false;
    const registrationOptions: RegistrationOptions =
      (context.propsValue.registrationOptions as RegistrationOptions) || {
        userFullName: undefined,
        sendConfirmationEmailOnRegister: false,
      };
    const config = configuration({ baseUrl });
    const oauthApi = new OAuthApi(config);

    const oauthGrantParam = buildOAuthGrantParam(
      context.propsValue.username,
      clientId,
      clientSecret,
      registerOnMissing || false,
      registrationOptions
    );

    try {
      const accessToken = await createImpersonateToken(oauthApi, oauthGrantParam);
      if (!fetchUserInfo) {
        return response({ ...accessToken } as unknown as Record<string, unknown>);
      }

      const userInfoResult = await fetchUserInfoIfNeeded(
        oauthApi,
        accessToken,
        true,
        clientId,
        clientSecret
      );

      if (userInfoResult === null) {
        return response({ token: null, user: null }, 'User not active');
      }

      return response({
        ...userInfoResult.token,
        ...(userInfoResult.user != null ? { user: userInfoResult.user } : {}),
      } as unknown as Record<string, unknown>);
    } catch (error) {
      const errorResult = handleImpersonateError(error, registerOnMissing || false);
      return response(errorResult, errorResult.error);
    }
  },
});
