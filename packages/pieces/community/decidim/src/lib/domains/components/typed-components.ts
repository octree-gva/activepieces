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
import { createComponentsApi } from '../../runtime/clients';
import {
  hostProp,
  decidimSpaceIdProp,
  decidimSpaceManifestProp,
  localesProp,
  pageProp,
  perPageProp,
  userAccessTokenProp,
} from '../../props';
import type { DecidimResourceList } from '../../types/decidim-api';
import { computeHasMore } from './search-component.helpers';
import {
  buildBlogComponentReadParams,
  buildBlogComponentsListParams,
  buildProposalComponentReadParams,
  buildProposalComponentsListParams,
} from './typed-components.params';

export const typedComponents = createAction({
  name: 'typedComponents',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Blog / Proposal components',
  description: 'List or read blog_components or proposal_components (OpenAPI typed component endpoints)',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    componentKind: Property.StaticDropdown({
      displayName: 'Component kind',
      required: true,
      options: {
        options: [
          { label: 'Blog components', value: 'blog' },
          { label: 'Proposal components', value: 'proposal' },
        ],
      },
    }),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'List', value: 'list' },
          { label: 'Read', value: 'read' },
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
          spaceManifest: decidimSpaceManifestProp(false),
          spaceId: decidimSpaceIdProp(false),
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
          componentId: Property.Number({
            displayName: 'Component ID',
            required: true,
          }),
          locales: localesProp(false),
          spaceManifest: decidimSpaceManifestProp(false),
          spaceId: decidimSpaceIdProp(false),
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
      const api = createComponentsApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const auth = bearerAuthorization(resolved.rawAccessToken);
      const kind = context.propsValue.componentKind as string;
      const op = context.propsValue.action as string;

      if (op === 'list') {
        const o = (context.propsValue.listOptions as Record<string, unknown>) || {};
        await propsValidation.validateZod(o, {
          page: z.number().int().min(1).optional(),
          perPage: z.number().int().min(1).max(100).optional(),
        });
        const page = z.number().int().min(1).default(1).parse(o.page ?? 1);
        const perPage = z.number().int().min(1).max(100).default(50).parse(o.perPage ?? 50);
        const result =
          kind === 'blog'
            ? await api.listBlogComponents(
                buildBlogComponentsListParams({
                  authorization: auth,
                  page,
                  perPage,
                  listOptions: o,
                })
              )
            : await api.listProposalComponents(
                buildProposalComponentsListParams({
                  authorization: auth,
                  page,
                  perPage,
                  listOptions: o,
                })
              );
        const list = (result.data as DecidimResourceList<unknown> | undefined)?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return response({
          components: arr,
          count: arr.length,
          has_more: computeHasMore(arr.length, perPage),
          auth_mode: resolved.mode,
        });
      }

      if (op === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        assertProp(o.componentId, 'Component ID is required');
        const id = z.number().int().positive().parse(o.componentId);
        const result =
          kind === 'blog'
            ? await api.showBlogComponent(
                buildBlogComponentReadParams({
                  authorization: auth,
                  componentId: id,
                  readOptions: o,
                })
              )
            : await api.showProposalComponent(
                buildProposalComponentReadParams({
                  authorization: auth,
                  componentId: id,
                  readOptions: o,
                })
              );
        const data = (result.data as { data?: unknown } | undefined)?.data;
        return response({
          component: data,
          component_id: String(id),
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${op}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
