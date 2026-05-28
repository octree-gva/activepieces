import { createAction, Property, InputPropertyMap } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createOrganizationsApi } from '../../runtime/clients';
import {
  localesProp,
  organizationIdStringProp,
  pageProp,
  perPageProp,
  updateOrganizationPayloadProp,
  userAccessTokenProp,
} from '../../props';
import { parseLocales } from '../../runtime/locales';
import { computeHasMore } from '../components/search-component.helpers';
import type {
  OrganizationsApiGetOrganizationRequest,
  OrganizationsApiListOrganizationsRequest,
  OrganizationsApiUpdateOrganizationRequest,
} from '@octree/decidim-sdk';
import { updateOrganizationPayloadFromRecord } from '../../runtime/sdk-casts';

export const organizations = createAction({
  name: 'organizations',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Organizations',
  description: 'List, get, or update organizations (admin scopes)',
  props: {
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'List', value: 'list' },
          { label: 'Read', value: 'read' },
          { label: 'Update', value: 'update' },
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
          locales: localesProp(false),
        };
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
          organizationId: organizationIdStringProp(true),
          locales: localesProp(false),
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
          organizationId: organizationIdStringProp(true),
          payload: updateOrganizationPayloadProp(true),
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

      if (action === 'list') {
        const o = (context.propsValue.listOptions as Record<string, unknown>) || {};
        await propsValidation.validateZod(o, {
          page: z.number().int().min(1).optional(),
          perPage: z.number().int().min(1).max(100).optional(),
        });
        const page = z.number().int().min(1).default(1).parse(o.page ?? 1);
        const perPage = z.number().int().min(1).max(100).default(50).parse(o.perPage ?? 50);
        const listReq: OrganizationsApiListOrganizationsRequest = {
          authorization: auth,
          page,
          perPage,
          locales: parseLocales(o.locales),
        };
        const result = await api.listOrganizations(listReq);
        const list = (result.data as { data?: unknown[] })?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return response({
          organizations: arr,
          count: arr.length,
          has_more: computeHasMore(arr.length, perPage),
          auth_mode: resolved.mode,
        });
      }

      if (action === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        assertProp(o.organizationId, 'Organization ID required');
        const id = z.string().min(1).parse(o.organizationId);
        const readReq: OrganizationsApiGetOrganizationRequest = {
          id,
          authorization: auth,
          locales: parseLocales(o.locales),
        };
        const result = await api.getOrganization(readReq);
        return response({
          organization: (result.data as { data?: unknown })?.data,
          organization_id: id,
          auth_mode: resolved.mode,
        });
      }

      if (action === 'update') {
        const o = (context.propsValue.updateOptions as Record<string, unknown>) || {};
        assertProp(o.organizationId, 'Organization ID required');
        assertProp(o.payload, 'Payload required');
        const id = z.string().min(1).parse(o.organizationId);
        const payload = o.payload as Record<string, unknown>;
        await propsValidation.validateZod({ payload }, { payload: z.record(z.string(), z.unknown()) });
        const updateOrganizationPayload = updateOrganizationPayloadFromRecord(payload);
        const updateReq: OrganizationsApiUpdateOrganizationRequest = {
          id,
          authorization: auth,
          updateOrganizationPayload,
        };
        const result = await api.updateOrganization(updateReq);
        return response({
          organization: (result.data as { data?: unknown })?.data,
          organization_id: id,
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
