import { createAction, Property, InputPropertyMap } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createRolesApi } from '../../runtime/clients';
import {
  hostProp,
  createRolePayloadProp,
  pageProp,
  perPageProp,
  roleIdProp,
  userAccessTokenProp,
} from '../../props';
import { computeHasMore } from '../components/search-component.helpers';
import type {
  RolesApiCreateRoleRequest,
  RolesApiDeleteRoleRequest,
  RolesApiGetRoleRequest,
  RolesApiListRolesRequest,
} from '@octree/decidim-sdk';
import { createRoleRequestBodyFromRecord } from '../../runtime/sdk-casts';

export const roles = createAction({
  name: 'roles',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Roles',
  description: 'List, read, create, or destroy roles (admin)',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'List', value: 'list' },
          { label: 'Read', value: 'read' },
          { label: 'Create', value: 'create' },
            { label: 'Add private assembly member', value: 'addPrivateAssemblyMember' },
          { label: 'Destroy', value: 'destroy' },
        ],
      },
    }),
    listOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'List options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'list') return {};
        return {
          page: pageProp(false),
          perPage: perPageProp(false),
        };
      },
    }),
    readDestroyOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Role id',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || (action !== 'read' && action !== 'destroy')) return {};
        return { roleId: roleIdProp(true) };
      },
    }),
    createOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Create role',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || (action !== 'create' && action !== 'addPrivateAssemblyMember')) return {};
        if (action === 'addPrivateAssemblyMember') {
          return {
            assemblyId: Property.Number({
              displayName: 'Assembly ID',
              required: true,
            }),
            userId: Property.Number({
              displayName: 'User ID',
              required: true,
            }),
          };
        }
        return { payload: createRolePayloadProp(true) };
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
      const api = createRolesApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const auth = bearerAuthorization(resolved.rawAccessToken);
      const action = context.propsValue.action;

      if (action === 'list') {
        const o = (context.propsValue.listOptions as Record<string, unknown>) || {};
        await propsValidation.validateZod(o, {
          page: z.number().int().min(1).optional(),
          perPage: z.number().int().min(1).max(100).optional(),
        });
        const page = z.number().int().min(1).default(1).parse(o.page ?? 1);
        const perPage = z.number().int().min(1).max(100).default(50).parse(o.perPage ?? 50);
        const listReq: RolesApiListRolesRequest = { authorization: auth, page, perPage };
        const result = await api.listRoles(listReq);
        const list = (result.data as { data?: unknown[] })?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return response({
          roles: arr,
          count: arr.length,
          has_more: computeHasMore(arr.length, perPage),
          auth_mode: resolved.mode,
        });
      }

      const idOpts = (context.propsValue.readDestroyOptions as Record<string, unknown>) || {};

      if (action === 'read') {
        assertProp(idOpts.roleId, 'Role ID required');
        const id = z.string().min(1).parse(idOpts.roleId);
        const readReq: RolesApiGetRoleRequest = { id, authorization: auth };
        const result = await api.getRole(readReq);
        return response({
          role: (result.data as { data?: unknown })?.data,
          role_id: id,
          auth_mode: resolved.mode,
        });
      }

      if (action === 'destroy') {
        assertProp(idOpts.roleId, 'Role ID required');
        const id = z.string().min(1).parse(idOpts.roleId);
        const destroyReq: RolesApiDeleteRoleRequest = { id, authorization: auth };
        await api.deleteRole(destroyReq);
        return response({ destroyed: true, role_id: id, auth_mode: resolved.mode });
      }

      if (action === 'create' || action === 'addPrivateAssemblyMember') {
        const c = (context.propsValue.createOptions as Record<string, unknown>) || {};
        let typedBody;
        if (action === 'addPrivateAssemblyMember') {
          await propsValidation.validateZod(c, {
            assemblyId: z.number().int().positive(),
            userId: z.number().int().positive(),
          });
          typedBody = createRoleRequestBodyFromRecord({
            data: {
              attributes: {
                resource_type: 'Decidim::Assembly',
                resource_id: c.assemblyId,
                user_id: c.userId,
                type: 'space_private_member',
              },
            },
          });
        } else {
          assertProp(c.payload, 'Payload required');
          const createRoleRequest = c.payload as Record<string, unknown>;
          await propsValidation.validateZod({ createRoleRequest }, {
            createRoleRequest: z.record(z.string(), z.unknown()),
          });
          typedBody = createRoleRequestBodyFromRecord(createRoleRequest);
        }
        const createReq: RolesApiCreateRoleRequest = {
          authorization: auth,
          createRoleRequest: typedBody,
        };
        const axiosResult = await api.createRole(createReq);
        return response({
          role: (axiosResult.data as { data?: unknown } | undefined)?.data,
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
