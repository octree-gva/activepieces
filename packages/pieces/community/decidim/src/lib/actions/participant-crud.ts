import { createAction, Property, InputPropertyMap, PropertyContext } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../decidimAuth';
import { extractAuth } from '../utils/auth';
import { configuration } from '../utils/configuration';
import { response } from '../utils/response';
import { OAuthApi, UsersApi, PasswordGrantImpersonateGrantTypeEnum, PasswordGrantImpersonateAuthTypeEnum, PasswordGrantImpersonateScopeEnum } from '@octree/decidim-sdk';
import { systemAccessToken } from '../utils/systemAccessToken';
import { introspectToken } from '../utils/introspecToken';
import { buildOAuthGrantParam, createImpersonateToken } from './impersonate';
import { assertProp } from '../utils/assertProp';
import { extendedDataQueryProp, userIdProp, usernameProp, userFullNameProp, emailProp, extendedDataProp, dataPathProp, fetchUserInfoProp } from '../props';
import axios from 'axios';

async function getUsersApi(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  decidimUserId?: string
): Promise<UsersApi> {
  const oauthApi = new OAuthApi(config);

  let accessToken: string;
  if (decidimUserId) {
    const userLoginResponse = await oauthApi.createToken({
      oauthGrantParam: {
        grant_type: PasswordGrantImpersonateGrantTypeEnum.Password,
        auth_type: PasswordGrantImpersonateAuthTypeEnum.Impersonate,
        id: decidimUserId,
        scope: PasswordGrantImpersonateScopeEnum.Oauth,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });
    accessToken = (userLoginResponse.data as any).access_token;
  } else {
    accessToken = await systemAccessToken(oauthApi, clientId, clientSecret);
  }

  return new UsersApi({
    ...config,
    isJsonMime: config.isJsonMime,
    accessToken,
  });
}

export async function searchParticipants(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  propsValue: Record<string, unknown>
) {
  const searchOptions = (propsValue['searchOptions'] as Record<string, unknown>) || {};
  assertProp(searchOptions['extendedDataQuery'], 'Extended Data Query is required for search');
  await propsValidation.validateZod(searchOptions, {
    extendedDataQuery: z.string().min(1, 'Extended Data Query must not be empty'),
  });

  let extendedDataQuery = searchOptions['extendedDataQuery'] as string;

  // Normalize JSON query string to handle whitespace differences
  // Since filterExtendedDataCont does substring matching on serialized JSON,
  // we need to ensure consistent formatting to match stored data format
  try {
    const parsed = JSON.parse(extendedDataQuery);
    // Parse and re-stringify to normalize, then ensure spaces after colons
    // This matches the format that works: "chatbotID": "31"
    extendedDataQuery = JSON.stringify(parsed).replace(/":/g, '": ');
  } catch {
    // If it's not valid JSON, normalize whitespace around colons
    // This handles partial queries: "chatbotID":"31" -> "chatbotID": "31"
    extendedDataQuery = extendedDataQuery.replace(/":\s*"/g, '": "');
  }

  const usersApi = await getUsersApi(config, clientId, clientSecret);
  const searchResult = await usersApi.users({
    filterExtendedDataCont: extendedDataQuery,
    perPage: 100,
  });

  const users = searchResult.data?.data || [];
  return response({ users, count: users.length });
}

export async function createParticipant(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  oauthApi: OAuthApi,
  propsValue: Record<string, unknown>
) {
  const createOptions = (propsValue['createOptions'] as Record<string, unknown>) || {};
  assertProp(createOptions['username'], 'Username is required for create');
  await propsValidation.validateZod(createOptions, {
    username: z.string().min(1, 'Username must not be empty'),
    userFullName: z.string().optional(),
    email: z.string().min(1, 'Email must not be empty').email('Invalid email format').optional(),
    extendedData: z.record(z.string(), z.any()).optional(),
  });

  const username = createOptions['username'] as string;
  const userFullName = createOptions['userFullName'] as string | undefined;
  const email = createOptions['email'] as string | undefined;
  const extendedData = createOptions['extendedData'] as Record<string, any> | undefined;
  const fetchUserInfo = (createOptions['fetchUserInfo'] as boolean) || false;

  // Search if user exists
  const usersApi = await getUsersApi(config, clientId, clientSecret);
  const searchResult = await usersApi.users({
    filterNicknameEq: username,
    perPage: 1,
  });

  let decidimUserId: string;
  let impersonateToken: any;

  if (searchResult.data?.data && searchResult.data.data.length > 0) {
    // User exists, use impersonate
    decidimUserId = searchResult.data.data[0].id.toString();
    const oauthGrantParam = buildOAuthGrantParam(
      username,
      clientId,
      clientSecret,
      false,
      { userFullName, email }
    );
    impersonateToken = await createImpersonateToken(oauthApi, oauthGrantParam);
  } else {
    // User doesn't exist, create with impersonate
    const oauthGrantParam = buildOAuthGrantParam(
      username,
      clientId,
      clientSecret,
      true,
      {
        userFullName,
        email,
        sendConfirmationEmailOnRegister: false,
      }
    );
    impersonateToken = await createImpersonateToken(oauthApi, oauthGrantParam);

    // Get user ID from introspect
    const systemToken = await systemAccessToken(oauthApi, clientId, clientSecret);
    const introspectResult = await introspectToken(
      oauthApi,
      impersonateToken.access_token,
      systemToken
    );

    if (!introspectResult?.resource?.id) {
      return response({}, 'Failed to create user');
    }

    decidimUserId = introspectResult.resource.id.toString();
  }

  // Set extended_data if provided
  if (extendedData) {
    const userApi = await getUsersApi(config, clientId, clientSecret, decidimUserId);
    await userApi.setUserData({
      userExtendedDataPayload: {
        object_path: '.',
        data: extendedData,
      },
    });
  }

  let user = null;
  if (fetchUserInfo) {
    const readResult = await readParticipant(
      config,
      clientId,
      clientSecret,
      { readOptions: { userId: decidimUserId } }
    );
    user = (readResult.ok && readResult.user) ? readResult.user : null;
  }

  return response({
    token: impersonateToken,
    userId: decidimUserId,
    user,
  });
}

export async function readParticipant(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  propsValue: Record<string, unknown>
) {
  const readOptions = (propsValue['readOptions'] as Record<string, unknown>) || {};
  assertProp(readOptions['userId'], 'User ID is required for read');
  await propsValidation.validateZod(readOptions, {
    userId: z.string().min(1, 'User ID must not be empty'),
  });

  const userId = readOptions['userId'] as string;

  const usersApi = await getUsersApi(config, clientId, clientSecret, userId);

  // Get user data
  let userData = null;
  try {
    const dataResult = await usersApi.userData({
      objectPath: '.',
    });
    userData = dataResult.data?.['data'] || null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      userData = null;
    } else {
      throw error;
    }
  }

  // Get user info
  const userResult = await usersApi.users({
    filterIdEq: parseInt(userId),
    perPage: 1,
  });
  const user = userResult.data?.data?.[0] || null;

  return response({
    userId,
    data: userData,
    user,
  });
}

export async function updateParticipant(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  propsValue: Record<string, unknown>
) {
  const updateOptions = (propsValue['updateOptions'] as Record<string, unknown>) || {};
  assertProp(updateOptions['userId'], 'User ID is required for update');

  // Check if extendedData is provided and not empty
  const rawExtendedData = updateOptions['extendedData'];
  if (!rawExtendedData ||
      (typeof rawExtendedData === 'object' && Object.keys(rawExtendedData).length === 0)) {
    throw new Error('Extended Data is required for update and must not be empty');
  }

  // Parse extendedData if it's a string
  if (typeof rawExtendedData === 'string') {
    try {
      updateOptions['extendedData'] = JSON.parse(rawExtendedData);
    } catch {
      throw new Error('Extended Data must be a valid JSON object');
    }
  }

  await propsValidation.validateZod(updateOptions, {
    userId: z.string().min(1, 'User ID must not be empty'),
    extendedData: z.record(z.string(), z.any()).refine(
      (data) => data && typeof data === 'object' && Object.keys(data).length > 0,
      'Extended Data must be a non-empty object with at least one key-value pair'
    ),
    dataPath: z.string().min(1, 'Data Path must not be empty').optional(),
  });

  const userId = updateOptions['userId'] as string;
  const extendedData = updateOptions['extendedData'] as Record<string, any>;
  const dataPath = (updateOptions['dataPath'] as string) || '.';

  const usersApi = await getUsersApi(config, clientId, clientSecret, userId);
  const result = await usersApi.setUserData({
    userExtendedDataPayload: {
      object_path: dataPath,
      data: extendedData,
    },
  });

  return response({
    userId,
    data: result.data?.['data'] || extendedData,
  });
}

export const participantCrud = createAction({
  name: 'participant',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Participant',
  description: 'Manage decidim participants',
  props: {
    action: Property.StaticDropdown({
      displayName: 'Action',
      description: 'The action to perform',
      required: true,
      options: {
        options: [
          { label: 'Search', value: 'search' },
          { label: 'Create', value: 'create' },
          { label: 'Read', value: 'read' },
          { label: 'Update', value: 'update' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search Options',
      description: 'Options for searching participants',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>, _ctx: PropertyContext): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (action !== 'search') {
          return {};
        }
        return {
          extendedDataQuery: extendedDataQueryProp(true),
        };
      },
    }),
    createOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Create Options',
      description: 'Options for creating a participant',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>, _ctx: PropertyContext): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (action !== 'create') {
          return {};
        }
        return {
          username: usernameProp(true),
          userFullName: userFullNameProp(false),
          email: emailProp(false),
          extendedData: extendedDataProp(false),
          fetchUserInfo: fetchUserInfoProp(false),
        };
      },
    }),
    readOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Read Options',
      description: 'Options for reading participant data',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>, _ctx: PropertyContext): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (action !== 'read') {
          return {};
        }
        return {
          userId: userIdProp(true),
        };
      },
    }),
    updateOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Update Options',
      description: 'Options for updating participant data',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>, _ctx: PropertyContext): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (action !== 'update') {
          return {};
        }
        return {
          userId: userIdProp(true),
          extendedData: extendedDataProp(true),
          dataPath: dataPathProp(false),
        };
      },
    }),
  },
  async run(context) {
    const { baseUrl, clientId, clientSecret } = extractAuth(context);
    const config = configuration({ baseUrl });
    const oauthApi = new OAuthApi(config);
    const action = context.propsValue.action;

    try {
      switch (action) {
        case 'search':
          return await searchParticipants(
            config,
            clientId,
            clientSecret,
            context.propsValue
          );

        case 'create':
          return await createParticipant(
            config,
            clientId,
            clientSecret,
            oauthApi,
            context.propsValue
          );

        case 'read':
          return await readParticipant(
            config,
            clientId,
            clientSecret,
            context.propsValue
          );

        case 'update':
          return await updateParticipant(
            config,
            clientId,
            clientSecret,
            context.propsValue
          );

        default:
          return response({}, `Unknown action: ${action}`);
      }
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data || error.message
        : error instanceof Error
        ? error.message
        : String(error);
      return response({}, errorMessage);
    }
  },
});
