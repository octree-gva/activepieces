import { createAction, Property, InputPropertyMap } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage, rethrowAxiosError } from '../../runtime/errors';
import { createOrganizationsApi } from '../../runtime/clients';
import {
  hostProp,
  organizationHostProp,
  organizationIdStringProp,
  userAccessTokenProp,
} from '../../props';
import type {
  OrganizationsApiGetOrganizationRequest,
  OrganizationsApiListOrganizationsRequest,
} from '@octree/decidim-sdk';

export const organizations = createAction({
  name: 'organizations',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Organizations',
  description: 'Search organizations by host, or read one by id',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      description: 'The action to perform',
      required: true,
      options: {
        options: [
          { label: 'Search', value: 'search' },
          { label: 'Read', value: 'read' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search Options',
      description: 'Options for searching organizations',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'search') return {};
        return {
          host: organizationHostProp(true),
        };
      },
    }),
    readOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Read Options',
      description: 'Options for reading an organization',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'read') return {};
        return {
          organizationId: organizationIdStringProp(true),
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
      const api = createOrganizationsApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const auth = bearerAuthorization(resolved.rawAccessToken);
      const action = context.propsValue.action;

      if (action === 'search') {
        const o = (context.propsValue.searchOptions as Record<string, unknown>) || {};
        assertProp(o.host, 'Host is required for Search');
        await propsValidation.validateZod(o, {
          host: z.string().min(1),
        });
        z.string().min(1).parse(o.host);
        const listReq: OrganizationsApiListOrganizationsRequest = {
          authorization: auth,
          page: 1,
          perPage: 100,
        };
        const result = await api.listOrganizations(listReq);
        return response((result.data ?? {}) as unknown as Record<string, unknown>);
      }

      if (action === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        assertProp(o.organizationId, 'Organization ID required');
        const id = z.string().min(1).parse(o.organizationId);
        const readReq: OrganizationsApiGetOrganizationRequest = {
          id,
          authorization: auth,
        };
        const result = await api.getOrganization(readReq);
        return response((result.data ?? {}) as unknown as Record<string, unknown>);
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      rethrowAxiosError(e);
      return response({}, getErrorMessage(e));
    }
  },
});
