import { createAction } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import {
  hostProp,
  componentIdsFilterProp,
  componentManifestsFilterProp,
  localesProp,
  pageProp,
  perPageProp,
  userAccessTokenProp,
} from '../../props';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { asComponentsApiSearchComponentsRequest } from '../../runtime/sdk-casts';
import { createComponentsApi } from '../../runtime/clients';
import {
  buildSearchComponentsRequestParams,
  computeHasMore,
} from './search-component.helpers';

function validateInput(propsValue: Record<string, unknown>): void | Promise<void> {
  const { page, perPage } = propsValue;
  return propsValidation.validateZod(
    { page, perPage },
    {
      page: z.number().int().min(1).optional(),
      perPage: z.number().int().min(1).max(100).optional(),
    }
  );
}

export const searchComponent = createAction({
  auth: decidimAuth,
  name: 'searchComponent',
  displayName: 'Search Component',
  description: 'Search or list components (proposals, meetings, blogs, etc.)',
  props: {
    host: hostProp(),
    accessToken: userAccessTokenProp(false),
    componentIds: componentIdsFilterProp(false),
    componentManifests: componentManifestsFilterProp(false),
    locales: localesProp(false),
    page: pageProp(false),
    perPage: perPageProp(false),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      await validateInput(context.propsValue);

      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      const componentsApi = createComponentsApi(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      );
      const { requestParams, effectivePerPage } = buildSearchComponentsRequestParams({
        accessToken: resolved.rawAccessToken,
        componentIds: context.propsValue['componentIds'],
        componentManifests: context.propsValue['componentManifests'],
        page: context.propsValue['page'],
        perPage: context.propsValue['perPage'],
        locales: context.propsValue['locales'],
      });

      const result = await componentsApi.searchComponents(
        asComponentsApiSearchComponentsRequest(requestParams)
      );
      const components =
        (result.data as { data?: unknown[] } | undefined)?.data ?? [];
      const has_more = computeHasMore(
        Array.isArray(components) ? components.length : 0,
        effectivePerPage
      );
      return response({
        components,
        count: Array.isArray(components) ? components.length : 0,
        has_more,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
