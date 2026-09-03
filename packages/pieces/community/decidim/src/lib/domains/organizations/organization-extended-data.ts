import { createAction, Property, InputPropertyMap } from '@activepieces/pieces-framework';
import { z } from 'zod';
import type {
  OrganizationsExtendedDataApiGetOrganizationExtendedDataRequest,
  OrganizationsExtendedDataApiSetOrganizationExtendedDataRequest,
} from '@octree/decidim-sdk';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createOrganizationsExtendedDataApi } from '../../runtime/clients';
import {
  hostProp,
  objectPathPropOrganization,
  organizationNumericIdProp,
  userAccessTokenProp,
} from '../../props';

export const organizationExtendedData = createAction({
  name: 'organizationExtendedData',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Organization extended data',
  description: 'GET/PUT organization extended_data hash',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'Read', value: 'read' },
          { label: 'Update', value: 'update' },
        ],
      },
    }),
    readOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Read options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'read') return {};
        return {
          organizationId: organizationNumericIdProp(true),
          objectPath: objectPathPropOrganization(true),
        };
      },
    }),
    updateOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Update options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'update') return {};
        return {
          organizationId: organizationNumericIdProp(true),
          objectPath: objectPathPropOrganization(false),
          data: Property.Json({
            displayName: 'Data',
            required: true,
            description: 'Merged into extended_data at object_path',
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
      const api = createOrganizationsExtendedDataApi(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      );
      const auth = bearerAuthorization(resolved.rawAccessToken);
      const action = context.propsValue.action;

      if (action === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        assertProp(o.organizationId, 'Organization ID required');
        assertProp(o.objectPath, 'Object path required');
        const id = z.number().int().positive().parse(o.organizationId);
        const objectPath = z.string().min(1).parse(o.objectPath);
        const readReq: OrganizationsExtendedDataApiGetOrganizationExtendedDataRequest = {
          id,
          objectPath,
          authorization: auth,
        };
        const result = await api.getOrganizationExtendedData(readReq);
        return response({
          data: (result.data as { data?: unknown })?.data,
          organization_id: String(id),
          object_path: objectPath,
          auth_mode: resolved.mode,
        });
      }

      if (action === 'update') {
        const o = (context.propsValue.updateOptions as Record<string, unknown>) || {};
        assertProp(o.organizationId, 'Organization ID required');
        assertProp(o.data, 'Data required');
        const id = z.number().int().positive().parse(o.organizationId);
        const object_path = o.objectPath ? z.string().parse(o.objectPath) : '.';
        const data = o.data as object;
        const setReq: OrganizationsExtendedDataApiSetOrganizationExtendedDataRequest = {
          id,
          authorization: auth,
          userExtendedDataPayload: { data, object_path },
        };
        const result = await api.setOrganizationExtendedData(setReq);
        return response({
          data: (result.data as { data?: unknown })?.data,
          organization_id: String(id),
          object_path,
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
