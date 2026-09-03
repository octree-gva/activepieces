import {
  createAction,
  Property,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import type {
  UsersApiGetUserExtendedDataRequest,
  UsersApiSetUserExtendedDataRequest,
} from '@octree/decidim-sdk';
import { createUsersApi } from '../../runtime/clients';
import { hostProp, userAccessTokenProp } from '../../props';

export const meExtendedData = createAction({
  name: 'meExtendedData',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'My extended data',
  description:
    'GET/PUT /me/extended_data (userData / setUserData). Requires a user access token; empty token uses client credentials and usually fails with 401/403.',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'Get (user — object_path)', value: 'get' },
          { label: 'Set (setUserData)', value: 'set' },
        ],
      },
    }),
    getOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Get options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'get') return {};
        return {
          objectPath: Property.ShortText({
            displayName: 'object_path',
            required: true,
            description: 'Dot path into extended_data (use "." for root)',
            defaultValue: '.',
          }),
        };
      },
    }),
    setOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Set options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'set') return {};
        return {
          objectPath: Property.ShortText({
            displayName: 'object_path',
            required: false,
            description: 'Merge target path; use "." for root',
            defaultValue: '.',
          }),
          data: Property.Json({
            displayName: 'data',
            required: true,
            description: 'Payload merged per OpenAPI setUserData',
          }),
        };
      },
    }),
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
      const api = createUsersApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const authHeader = bearerAuthorization(resolved.rawAccessToken);
      const op = context.propsValue.action as string;

      if (op === 'get') {
        const o = (context.propsValue.getOptions as Record<string, unknown>) || {};
        assertProp(o.objectPath, 'object_path is required');
        const object_path = z.string().min(1).parse(o.objectPath);
        const getReq: UsersApiGetUserExtendedDataRequest = {
          authorization: authHeader,
          objectPath: object_path,
        };
        const result = await api.getUserExtendedData(getReq);
        return response({
          data: (result.data as { data?: unknown })?.data,
          object_path,
          auth_mode: resolved.mode,
        });
      }

      if (op === 'set') {
        const o = (context.propsValue.setOptions as Record<string, unknown>) || {};
        assertProp(o.data, 'data is required');
        await propsValidation.validateZod(o, { data: z.record(z.string(), z.unknown()) });
        const object_path = z.string().default('.').parse(o.objectPath ?? '.');
        const setReq: UsersApiSetUserExtendedDataRequest = {
          authorization: authHeader,
          userExtendedDataPayload: {
            data: o.data as object,
            object_path,
          },
        };
        const result = await api.setUserExtendedData(setReq);
        return response({
          data: (result.data as { data?: unknown })?.data,
          object_path,
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${op}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
