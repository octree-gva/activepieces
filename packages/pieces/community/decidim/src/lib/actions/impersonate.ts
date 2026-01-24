import {
  createAction,
  InputPropertyMap,
  Property,
  PropertyContext,
} from '@activepieces/pieces-framework';
import { decidimAuth } from '../../decidimAuth';
import { OAuthApi, Configuration } from '@octree/decidim-sdk';
import { DecidimAccessToken } from '../../types';
import axios from 'axios';

export const impersonate = createAction({
  name: 'impersonate',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Impersonate',
  description: 'Get an access token to do action as a participant',

  props: {
    username: Property.ShortText({
      displayName: 'Nickname',
      required: true,
      description: 'The nickname of the user to impersonate',
    }),
    fetchUserInfo: Property.Checkbox({
      displayName: 'Fetch user info?',
      required: false,
      description: 'If enabled, the user info will be fetched from the Decidim API',
      defaultValue: true,
    }),
    registerOnMissing: Property.Checkbox({
      displayName: 'Register on missing?',
      required: false,
      description: 'If enabled, the user will be registered if they do not exist',
      defaultValue: false,
    }),
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
          userFullName: Property.ShortText({
            displayName: 'User Full Name',
            required: false,
            description:
              'The name of the user to impersonate (used for registration)',
          }),
          sendConfirmationEmailOnRegister: Property.Checkbox({
            displayName: 'Send confirmation email on registration?',
            required: false,
            description:
              'If enabled, the user will be registered but will need to confirm their email address by clicking a link in an email',
            defaultValue: false,
          }),
        };
      },
    }),
  },
  async run(context) {
    const typedAuth = context.auth as { clientId: string; clientSecret: string; baseUrl: string };
    const {baseUrl, clientId, clientSecret} = typedAuth;
    console.log("context.auth", JSON.stringify(context.auth, null, 2));
    const contextPropsValue = context.propsValue as any;
    const fetchUserInfo = contextPropsValue.fetchUserInfo as boolean;
    if(!clientId) {
      throw new Error('Client ID is required');
    }
    if(!clientSecret) {
      throw new Error('Client Secret is required');
    }
    if(!baseUrl) {
      throw new Error('Base URL is required');
    }
    const configuration: Configuration = {
      basePath: `${baseUrl}/api/rest_full/v0.2`,
      isJsonMime: () => true,
    };

    const oauthApi = new OAuthApi(configuration);

    const registrationOptions = context.propsValue.registrationOptions || {};
    const oauthGrantParam = {
      grant_type: 'password' as const,
      auth_type: 'impersonate' as const,
      username: context.propsValue.username,
      meta: {
        register_on_missing: context.propsValue.registerOnMissing,
        skip_confirmation_on_register: !registrationOptions['sendConfirmationEmailOnRegister'],
        name: registrationOptions['userFullName'] || undefined,
      },
      scope: 'oauth' as const,
      client_id: clientId,
      client_secret: clientSecret,
    };

    try {
      const tokenResponse = await oauthApi.createToken({ oauthGrantParam });
      const accessToken = tokenResponse.data as unknown as DecidimAccessToken;
      if (!fetchUserInfo) {
        return {
          ok: true,
          token: accessToken,
          user: null,
          error: null,
        };
      }

      const systemAccessResponse = await oauthApi.createToken({
        oauthGrantParam: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'oauth' } });
        const systemAccessToken = systemAccessResponse.data as unknown as DecidimAccessToken;

      const userResponse = await oauthApi.introspectToken({
        introspectToken: { token: accessToken.access_token },
      }, {
        headers: {
          Authorization: `Bearer ${systemAccessToken.access_token}`,
        },
      });

      return {
        token: accessToken,
        user: userResponse.data.resource,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data || error.message;
        const status = error.response?.status;
        if(status === 404 && !contextPropsValue.registerOnMissing) {
          return {
            ok: true,
            token: null,
            user: null,
            error: "User not found",
          };
        }
        throw new Error(JSON.stringify({
          ok: false,
          token: null,
          user: null,
          error: errorData,
        }));
      }
      throw new Error(JSON.stringify({
        ok: false,
        token: null,
        user: null,
        error: error.message || String(error),
      }));
    }
  },
});
