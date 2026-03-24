import {
  createAction,
  Property,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import {
  ClientCredentialGrantTypeEnum,
  ClientCredentialScopeEnum,
  type OauthGrantParam,
  type OAuthApiCreateTokenRequest,
} from '@octree/decidim-sdk';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { getErrorMessage } from '../../runtime/errors';
import { oauthTokenBodyFromResponse } from '../../runtime/sdk-casts';
import { createOAuthApi } from '../../runtime/clients';
import { configuration } from '../../utils/configuration';

const SCOPE_OPTIONS = Object.values(ClientCredentialScopeEnum).map((value) => ({
  label: value,
  value,
}));

export const oauthRequestToken = createAction({
  name: 'oauthRequestToken',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'OAuth request token',
  description:
    'POST /oauth/token (createToken). Use client_credentials with piece secrets, or paste an advanced grant body (PasswordGrantImpersonate, etc.).',
  props: {
    mode: Property.StaticDropdown({
      displayName: 'Grant mode',
      required: true,
      options: {
        options: [
          { label: 'Client credentials (piece Client ID / Secret)', value: 'client_credentials' },
          { label: 'Advanced — JSON body (OauthGrantParam)', value: 'advanced_json' },
        ],
      },
    }),
    clientCredentialOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Client credentials',
      required: false,
      refreshers: ['mode', 'auth'],
      props: async ({ mode, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || mode !== 'client_credentials') return {};
        return {
          scope: Property.StaticDropdown({
            displayName: 'scope',
            required: true,
            defaultValue: ClientCredentialScopeEnum.Oauth,
            options: { options: SCOPE_OPTIONS },
            description: 'Single scope per SDK enum; use Advanced for multi-scope or other grants.',
          }),
        };
      },
    }),
    advancedOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Advanced',
      required: false,
      refreshers: ['mode', 'auth'],
      props: async ({ mode, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || mode !== 'advanced_json') return {};
        return {
          oauthGrantParam: Property.Json({
            displayName: 'oauth_grant_param',
            required: true,
            description:
              'JSON matching OpenAPI oauth_grant_param (ClientCredential | PasswordGrantImpersonate | PasswordGrantLogin).',
          }),
        };
      },
    }),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const oauthApi = createOAuthApi(configuration({ baseUrl }));
      const mode = context.propsValue.mode as string;

      let oauthGrantParam: OauthGrantParam;

      if (mode === 'client_credentials') {
        const o = (context.propsValue.clientCredentialOptions as Record<string, unknown>) || {};
        assertProp(o.scope, 'scope is required');
        oauthGrantParam = {
          grant_type: ClientCredentialGrantTypeEnum.ClientCredentials,
          client_id: clientId,
          client_secret: clientSecret,
          scope: o.scope as ClientCredentialScopeEnum,
        };
      } else if (mode === 'advanced_json') {
        const o = (context.propsValue.advancedOptions as Record<string, unknown>) || {};
        assertProp(o.oauthGrantParam, 'oauth_grant_param is required');
        oauthGrantParam = o.oauthGrantParam as OauthGrantParam;
      } else {
        return response({}, `Unknown mode: ${mode}`);
      }

      const createReq: OAuthApiCreateTokenRequest = { oauthGrantParam };
      const tokenResponse = await oauthApi.createToken(createReq);
      const data = oauthTokenBodyFromResponse(tokenResponse.data);

      return response({
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        scope: data.scope,
        created_at: data.created_at,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
