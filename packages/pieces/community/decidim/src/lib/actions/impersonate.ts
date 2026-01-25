import {
  createAction,
  InputPropertyMap,
  Property,
  PropertyContext,
} from '@activepieces/pieces-framework';
import { decidimAuth } from '../../decidimAuth';
import { OAuthApi, PasswordGrantImpersonate, PasswordGrantImpersonateAuthTypeEnum, PasswordGrantImpersonateGrantTypeEnum, PasswordGrantImpersonateScopeEnum, ResourceDetails } from '@octree/decidim-sdk';
import { DecidimAccessToken } from '../../types';
import axios from 'axios';
import {
  usernameProp,
  fetchUserInfoProp,
  registerOnMissingProp,
  userFullNameProp,
  sendConfirmationEmailOnRegisterProp,
} from '../props';
import { systemAccessToken } from '../utils/systemAccessToken';
import { introspectToken } from '../utils/introspecToken';
import { configuration } from '../utils/configuration';
import { extractAuth } from '../utils/auth';
import { response } from '../utils/response';

export interface RegistrationOptions {
  userFullName?: string;
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
  return tokenResponse.data as unknown as DecidimAccessToken;
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
): { token: null; user: null; error: string } {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data || error.message;
    const status = error.response?.status;
    if (status === 404 && !registerOnMissing) {
      return { token: null, user: null, error: 'User not found' };
    }
    return { token: null, user: null, error: JSON.stringify(errorData) };
  }
  const errorMessage = error instanceof Error ? error.message : String(error);
  return { token: null, user: null, error: errorMessage };
}

export const impersonate = createAction({
  name: 'impersonate',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Impersonate',
  description: 'Get an access token to do action as a participant',

  props: {
    username: usernameProp,
    fetchUserInfo: fetchUserInfoProp,
    registerOnMissing: registerOnMissingProp,
    registrationOptions: Property.DynamicProperties({
      displayName: 'Registration Options',
      description: 'Options for user registration',
      required: false,
      refreshers: ['registerOnMissing', 'auth'],
			props: async ({registerOnMissing, auth}: Record<string, unknown>, _ctx: PropertyContext): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (!registerOnMissing || registerOnMissing === false) {
          return {};
        }
        return {
          userFullName: userFullNameProp,
          sendConfirmationEmailOnRegister: sendConfirmationEmailOnRegisterProp,
        };
      },
    }),
  },
  async run(context) {
    const { baseUrl, clientId, clientSecret } = extractAuth(context);
    const fetchUserInfo = context.propsValue.fetchUserInfo;
    const registerOnMissing = context.propsValue.registerOnMissing;
    const registrationOptions: RegistrationOptions = context.propsValue.registrationOptions || {
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
      const userInfoResult = await fetchUserInfoIfNeeded(
        oauthApi,
        accessToken,
        fetchUserInfo || false,
        clientId,
        clientSecret
      );

      if (userInfoResult === null) {
        return response({ token: null, user: null }, 'User not active');
      }

      return response(userInfoResult);
    } catch (error) {
      const errorResult = handleImpersonateError(error, registerOnMissing || false);
      return response(errorResult, errorResult.error);
    }
  },
});
