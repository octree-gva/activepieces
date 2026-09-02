import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod, propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { getErrorMessage } from '../../runtime/errors';
import { usernameProp } from '../../props';

const grantTypeSchema = z.enum(['password', 'client_credentials']);

export const getToken = createAction({
  name: 'getToken',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Get Token',
  description: 'Request an OAuth access token (ROPC or client credentials)',
  props: {
    grantType: Property.StaticDropdown({
      displayName: 'Grant type',
      description: 'ROPC impersonates a participant. Client credentials is machine-to-machine.',
      required: true,
      options: {
        options: [
          { label: 'ROPC', value: 'password' },
          { label: 'Client Credentials', value: 'client_credentials' },
        ],
      },
    }),
    scope: Property.ShortText({
      displayName: 'Scope',
      description: 'Space-separated OAuth scopes, for example public system or public oauth whatsapp.',
      required: true,
    }),
    ropcOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'ROPC Options',
      description: 'Nickname used when grant type is ROPC',
      required: false,
      refreshers: ['grantType'],
      props: async ({ grantType }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (grantType !== 'password') return {};
        return {
          nickname: usernameProp(true),
        };
      },
    }),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      await propsValidation.validateZod(context.propsValue, {
        grantType: grantTypeSchema,
        scope: z.string().min(1),
      });
      const grantType = grantTypeSchema.parse(context.propsValue.grantType);
      const scope = z.string().min(1).parse(context.propsValue.scope);
      const nickname = nicknameFromRopcOptions(context.propsValue.ropcOptions);
      if (grantType === 'password') {
        assertProp(nickname, 'Nickname is required');
      }
      const accessToken = await requestAccessToken({
        baseUrl,
        body: oauthTokenBody({
          grantType,
          clientId,
          clientSecret,
          scope,
          nickname,
        }),
      });
      return response({ accessToken });
    } catch (e) {
      return response({ accessToken: null }, getErrorMessage(e));
    }
  },
});

async function requestAccessToken(input: {
  baseUrl: string;
  body: Record<string, unknown>;
}): Promise<string> {
  const tokenResponse = await httpClient.sendRequest<{
    access_token?: string;
  }>({
    method: HttpMethod.POST,
    url: `${input.baseUrl.replace(/\/$/, '')}/oauth/token`,
    headers: {
      'Content-Type': 'application/json',
    },
    body: input.body,
  });
  const accessToken = tokenResponse.body?.access_token;
  if (!accessToken) {
    throw new Error('Decidim OAuth response did not include access_token');
  }
  return accessToken;
}

function oauthTokenBody(input: {
  grantType: z.infer<typeof grantTypeSchema>;
  clientId: string;
  clientSecret: string;
  scope: string;
  nickname: string | undefined;
}): Record<string, unknown> {
  if (input.grantType === 'client_credentials') {
    return {
      grant_type: 'client_credentials',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      scope: input.scope,
    };
  }
  return {
    grant_type: 'password',
    auth_type: 'impersonate',
    username: input.nickname,
    meta: {
      register_on_missing: true,
      accept_tos_on_register: true,
      skip_confirmation_on_register: true,
    },
    client_id: input.clientId,
    client_secret: input.clientSecret,
    scope: input.scope,
  };
}

function nicknameFromRopcOptions(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const nickname = value.nickname;
  return typeof nickname === 'string' ? nickname : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
