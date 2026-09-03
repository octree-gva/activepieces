import { createAction, Property, InputPropertyMap } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { configuration } from '../../utils/configuration';
import { response } from '../../utils/response';
import {
  OAuthApi,
  UsersApi,
  PasswordGrantImpersonateGrantTypeEnum,
  PasswordGrantImpersonateAuthTypeEnum,
  PasswordGrantImpersonateScopeEnum,
} from '@octree/decidim-sdk';
import { systemAccessToken } from '../../utils/systemAccessToken';
import { introspectToken } from '../../utils/introspecToken';
import { buildOAuthGrantParam, createImpersonateToken } from './impersonate';
import { assertProp } from '../../utils/assertProp';
import {
  hostProp,
  participantExtendedDataFiltersProp,
  participantNicknamesFilterProp,
  participantUserIdsFilterProp,
  userIdProp,
  usernameProp,
  userFullNameProp,
  emailProp,
  extendedDataProp,
  dataPathProp,
  fetchUserInfoProp,
} from '../../props';
import axios from 'axios';
import { getErrorMessage } from '../../runtime/errors';
import {
  asUsersApiSetUserDataRequest,
  asUsersApiUserDataRequest,
  asUsersApiUsersRequest,
  oauthTokenBodyFromResponse,
} from '../../runtime/sdk-casts';
import type { JsonObject } from '../../types/decidim-api';
import type { DecidimAccessToken } from '../../../types';
import { toExtendedDataSearchQuery } from './upsert-helpers';

async function getUsersApi(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  decidimUserId?: string
): Promise<{ usersApi: UsersApi; authorization: string }> {
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
    const tokenBody = oauthTokenBodyFromResponse(userLoginResponse.data);
    accessToken = z.string().min(1).parse(tokenBody.access_token);
  } else {
    accessToken = await systemAccessToken(oauthApi, clientId, clientSecret);
  }

  const usersApi = new UsersApi({
    ...config,
    isJsonMime: config.isJsonMime,
    accessToken,
  });
  return { usersApi, authorization: `Bearer ${accessToken}` };
}

export async function searchParticipants(
  config: ReturnType<typeof configuration>,
  clientId: string,
  clientSecret: string,
  propsValue: Record<string, unknown>
) {
  const nested = propsValue['searchOptions'];
  const searchOptions =
    nested !== null && typeof nested === 'object'
      ? { ...propsValue, ...(nested as Record<string, unknown>) }
      : propsValue;
  const listReq = buildParticipantSearchRequest(searchOptions);

  const { usersApi, authorization } = await getUsersApi(config, clientId, clientSecret);
  const searchResult = await usersApi.listUsers(
    asUsersApiUsersRequest({
      ...listReq,
      authorization,
    })
  );

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
    extendedData: z.record(z.string(), z.unknown()).optional(),
  });

  const username = createOptions['username'] as string;
  const userFullName = createOptions['userFullName'] as string | undefined;
  const email = createOptions['email'] as string | undefined;
  const extendedData = createOptions['extendedData'] as JsonObject | undefined;
  const fetchUserInfo = (createOptions['fetchUserInfo'] as boolean) || false;

  const { usersApi, authorization } = await getUsersApi(config, clientId, clientSecret);
  const searchResult = await usersApi.listUsers(
    asUsersApiUsersRequest({
      authorization,
      filterNicknameEq: username,
      perPage: 1,
    })
  );

  let decidimUserId: string;
  let impersonateToken: DecidimAccessToken;

  if (searchResult.data?.data && searchResult.data.data.length > 0) {
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

  if (extendedData) {
    const { usersApi: userApi, authorization } = await getUsersApi(config, clientId, clientSecret, decidimUserId);
    await userApi.setUserExtendedData(
      asUsersApiSetUserDataRequest({
        authorization,
        userExtendedDataPayload: {
          object_path: '.',
          data: extendedData,
        },
      })
    );
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

  const { usersApi, authorization } = await getUsersApi(config, clientId, clientSecret, userId);

  let userData = null;
  try {
    const dataResult = await usersApi.getUserExtendedData(
      asUsersApiUserDataRequest({
        authorization,
        objectPath: '.',
      })
    );
    userData = dataResult.data?.['data'] || null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      userData = null;
    } else {
      throw error;
    }
  }

  const userResult = await usersApi.listUsers(
    asUsersApiUsersRequest({
      authorization,
      filterIdEq: parseInt(userId, 10),
      perPage: 1,
    })
  );
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

  const rawExtendedData = updateOptions['extendedData'];
  if (!rawExtendedData ||
      (typeof rawExtendedData === 'object' && Object.keys(rawExtendedData).length === 0)) {
    throw new Error('Extended Data is required for update and must not be empty');
  }

  if (typeof rawExtendedData === 'string') {
    try {
      updateOptions['extendedData'] = JSON.parse(rawExtendedData);
    } catch {
      throw new Error('Extended Data must be a valid JSON object');
    }
  }

  await propsValidation.validateZod(updateOptions, {
    userId: z.string().min(1, 'User ID must not be empty'),
    extendedData: z.record(z.string(), z.unknown()).refine(
      (data) => data && typeof data === 'object' && Object.keys(data).length > 0,
      'Extended Data must be a non-empty object with at least one key-value pair'
    ),
    dataPath: z.string().min(1, 'Data Path must not be empty').optional(),
  });

  const userId = updateOptions['userId'] as string;
  const extendedData = updateOptions['extendedData'] as JsonObject;
  const dataPath = (updateOptions['dataPath'] as string) || '.';

  const { usersApi, authorization } = await getUsersApi(config, clientId, clientSecret, userId);
  const result = await usersApi.setUserExtendedData(
    asUsersApiSetUserDataRequest({
      authorization,
      userExtendedDataPayload: {
        object_path: dataPath,
        data: extendedData,
      },
    })
  );

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
    host: hostProp(),
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
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'search') {
          return {};
        }
        return {
          userIds: participantUserIdsFilterProp(false),
          nicknames: participantNicknamesFilterProp(false),
          extendedDataFilters: participantExtendedDataFiltersProp(false),
        };
      },
    }),
    createOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Create Options',
      description: 'Options for creating a participant',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
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
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
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
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
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
      return response({}, getErrorMessage(error));
    }
  },
});

function buildParticipantSearchRequest(searchOptions: Record<string, unknown>): {
  perPage: number;
  filterIdIn?: number[];
  filterNicknameIn?: string[];
  filterNicknameEq?: string;
  filterExtendedDataCont?: string;
} {
  const req: {
    perPage: number;
    filterIdIn?: number[];
    filterNicknameIn?: string[];
    filterNicknameEq?: string;
    filterExtendedDataCont?: string;
  } = { perPage: 100 };

  const ids = parsePositiveIdList(searchOptions['userIds']);
  if (ids) req.filterIdIn = ids;

  const nicknames = parseStringList(searchOptions['nicknames']);
  if (nicknames) {
    if (nicknames.length === 1) req.filterNicknameEq = nicknames[0];
    else req.filterNicknameIn = nicknames;
  }

  const cont = buildExtendedDataCont(searchOptions['extendedDataFilters']);
  if (cont) req.filterExtendedDataCont = cont;

  return req;
}

function rowValue(row: unknown): unknown {
  if (row !== null && typeof row === 'object' && 'value' in row) {
    return Reflect.get(row, 'value');
  }
  return row;
}

function parseArrayValues(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(rowValue)
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

function parsePositiveIdList(raw: unknown): number[] | undefined {
  const values = parseArrayValues(raw);
  if (values.length === 0) return undefined;
  return values.map((v) => z.number().int().gt(0).parse(Number(v)));
}

function parseStringList(raw: unknown): string[] | undefined {
  const values = parseArrayValues(raw);
  if (values.length === 0) return undefined;
  return values.map((v) => z.string().min(1).parse(String(v).trim()));
}

function buildExtendedDataCont(raw: unknown): string | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const first = raw[0];
  if (first === null || typeof first !== 'object') return undefined;

  const key = String(Reflect.get(first, 'key') ?? '').trim();
  const value = Reflect.get(first, 'value');
  if (!key) return undefined;
  return toExtendedDataSearchQuery(key, value);
}
