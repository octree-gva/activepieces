import { createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { configuration } from '../../utils/configuration';
import { response } from '../../utils/response';
import { getErrorMessage, rethrowAxiosError } from '../../runtime/errors';
import { asResponseRecord, asUsersApiUsersRequest } from '../../runtime/sdk-casts';
import { createParticipant, updateParticipant } from './participant-crud';
import {
  hostProp,
  emailProp,
  extendedDataProp,
  fetchUserInfoProp,
  registerOnMissingProp,
  userFullNameProp,
  usernameProp,
} from '../../props';
import {
  buildNestedObject,
  fallbackNickname,
  toExtendedDataSearchQuery,
  upsertBySchema,
} from './upsert-helpers';
import { systemAccessToken } from '../../utils/systemAccessToken';

type UpsertBy = z.infer<typeof upsertBySchema>;

function upsertByProp() {
  return Property.StaticDropdown({
    displayName: 'Upsert by',
    required: true,
    options: {
      options: [
        { label: 'Extended data', value: 'extended_data' },
        { label: 'Nickname', value: 'nickname' },
        { label: 'Email', value: 'email' },
      ],
    },
  });
}

function extractUserIdFromCreateResult(createResult: Record<string, unknown>): string | null {
  const introspect = createResult['introspect'];
  if (introspect !== null && typeof introspect === 'object') {
    const resource = Reflect.get(introspect, 'resource');
    if (resource !== null && typeof resource === 'object') {
      const id = Reflect.get(resource, 'id');
      if (id !== undefined && id !== null && String(id).trim() !== '') {
        return String(id);
      }
    }
  }

  const users = createResult['users'];
  if (users !== null && typeof users === 'object') {
    const data = Reflect.get(users, 'data');
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (first !== null && typeof first === 'object') {
        const id = Reflect.get(first, 'id');
        if (id !== undefined && id !== null && String(id).trim() !== '') {
          return String(id);
        }
      }
    }
  }

  return null;
}

function apiBodyFromResponse(result: Record<string, unknown>): Record<string, unknown> {
  const { ok: _ok, error: _error, ...body } = result;
  return body;
}

export const upsertParticipant = createAction({
  name: 'upsertParticipant',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Upsert participant',
  description: 'Find participant by key and create if missing',
  props: {
    host: hostProp(),
    by: upsertByProp(),
    options: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Upsert options',
      required: false,
      refreshers: ['by', 'auth'],
      props: async ({ by, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth) return {};
        const byValue = by as UpsertBy;
        const base: InputPropertyMap = {
          userFullName: userFullNameProp(false),
          email: emailProp(false),
          nickname: usernameProp(false),
          extendedData: extendedDataProp(false),
          registerOnMissing: registerOnMissingProp(false),
          fetchUserInfo: fetchUserInfoProp(false),
        };

        if (byValue === 'extended_data') {
          return {
            ...base,
            jsonPath: Property.ShortText({
              displayName: 'JSON path',
              required: true,
              description: 'Dot path in extended_data used to match (e.g. phone or contacts.phone).',
            }),
            value: Property.ShortText({
              displayName: 'Match value',
              required: true,
            }),
          };
        }
        return base;
      },
    }),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const config = configuration({ baseUrl });
      const oauthApi = new OAuthApi(config);
      const token = await systemAccessToken(oauthApi, clientId, clientSecret);
      const usersApi = new UsersApi({
        ...config,
        isJsonMime: config.isJsonMime,
        accessToken: token,
      });
      const authorization = `Bearer ${token}`;

      const by = upsertBySchema.parse(context.propsValue.by);
      const options = (context.propsValue.options as Record<string, unknown>) || {};
      const registerOnMissing = options.registerOnMissing === true;
      const fetchUserInfo = options.fetchUserInfo !== false;
      const userFullName = (options.userFullName as string | undefined)?.trim();
      const email = (options.email as string | undefined)?.trim();
      const nickname = (options.nickname as string | undefined)?.trim();
      const extendedData = (options.extendedData as Record<string, unknown> | undefined) || {};

      const searchReq: Record<string, unknown> = {
        authorization,
        perPage: 1,
      };

      let matchedValue = '';
      if (by === 'nickname') {
        await propsValidation.validateZod(options, { nickname: z.string().min(1) });
        searchReq.filterNicknameEq = options.nickname;
        matchedValue = String(options.nickname);
      } else if (by === 'email') {
        await propsValidation.validateZod(options, { email: z.string().email() });
        searchReq.filterEmailEq = options.email;
        matchedValue = String(options.email);
      } else {
        await propsValidation.validateZod(options, {
          jsonPath: z.string().min(1),
          value: z.union([z.string(), z.number()]),
        });
        const jsonPath = String(options.jsonPath);
        const value = options.value as string | number;
        searchReq.filterExtendedDataCont = toExtendedDataSearchQuery(jsonPath, value);
        matchedValue = String(value);
      }

      const searchResult = await usersApi.listUsers(asUsersApiUsersRequest(searchReq));
      const existing = searchResult.data?.data?.[0] ?? null;
      const usersBody = asResponseRecord(searchResult.data);

      if (existing) {
        return response({ users: usersBody });
      }

      if (!registerOnMissing) {
        return response({ users: usersBody });
      }

      const username = fallbackNickname({
        nickname,
        email,
        matchValue: matchedValue,
      });

      const createResult = await createParticipant(
        config,
        clientId,
        clientSecret,
        oauthApi,
        {
          createOptions: {
            username,
            userFullName,
            email,
            extendedData,
            fetchUserInfo,
          },
        }
      );

      if (!createResult.ok) {
        return createResult;
      }

      if (by === 'extended_data') {
        const userId = extractUserIdFromCreateResult(createResult);
        if (!userId) {
          return response(
            {},
            'Upsert failed: could not determine user id after create'
          );
        }
        const jsonPath = String(options.jsonPath);
        const value = options.value as string | number;
        const nested = buildNestedObject(jsonPath, value);
        const updateResult = await updateParticipant(config, clientId, clientSecret, {
          updateOptions: {
            userId,
            extendedData: nested,
            dataPath: '.',
          },
        });
        if (!updateResult.ok) {
          return updateResult;
        }
        return response({
          ...apiBodyFromResponse(createResult),
          extended_data: apiBodyFromResponse(updateResult),
        });
      }

      return createResult;
    } catch (e) {
      rethrowAxiosError(e);
      return response({}, getErrorMessage(e));
    }
  },
});
