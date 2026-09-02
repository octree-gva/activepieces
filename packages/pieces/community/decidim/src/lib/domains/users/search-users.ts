import { createAction } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createUsersApi } from '../../runtime/clients';
import { pageProp, perPageProp, userAccessTokenProp } from '../../props';
import { computeHasMore } from '../components/search-component.helpers';
import type { UsersApiListUsersRequest } from '@octree/decidim-sdk';
import type { DecidimResourceList } from '../../types/decidim-api';

export const searchUsers = createAction({
  name: 'usersList',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Search Users',
  description: 'Search users (GET /users, scoped by token)',
  props: {
    accessToken: userAccessTokenProp(false),
    page: pageProp(false),
    perPage: perPageProp(false),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      await propsValidation.validateZod(context.propsValue, {
        page: z.number().int().min(1).optional(),
        perPage: z.number().int().min(1).max(100).optional(),
      });
      const page = z.number().int().min(1).default(1).parse(context.propsValue.page ?? 1);
      const perPage = z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .parse(context.propsValue.perPage ?? 50);

      const api = createUsersApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const usersReq: UsersApiListUsersRequest = {
        authorization: bearerAuthorization(resolved.rawAccessToken),
        page,
        perPage,
      };
      const result = await api.listUsers(usersReq);
      const list = (result.data as DecidimResourceList<unknown> | undefined)?.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      return response({
        users: arr,
        count: arr.length,
        has_more: computeHasMore(arr.length, perPage),
        auth_mode: resolved.mode,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
