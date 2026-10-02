import { createAction, Property } from '@activepieces/pieces-framework';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import {
  hostProp,
  spaceIdsFilterProp,
  spaceManifestsFilterProp,
  spaceSearchLanguagesProp,
  spaceSearchPageProp,
  spaceSearchPerPageProp,
} from '../../props';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { asSpacesApiSearchSpacesRequest } from '../../runtime/sdk-casts';
import { createSpacesApi } from '../../runtime/clients';
import { buildSearchSpacesRequestParams } from './spaces-search-params';

export const searchParticipatorySpace = createAction({
  auth: decidimAuth,
  name: 'searchParticipatorySpace',
  displayName: 'Search Participatory Space',
  description: 'Search assemblies, processes, conferences, or initiatives',
  props: {
    host: hostProp(),
    accessToken: Property.ShortText({
      displayName: 'User token',
      required: false,
      description: 'If you impersonate a user.',
    }),
    spaceIds: spaceIdsFilterProp(false),
    spaceManifests: spaceManifestsFilterProp(false),
    locales: spaceSearchLanguagesProp(false),
    perPage: spaceSearchPerPageProp(false),
    page: spaceSearchPageProp(false),
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
      const client = createSpacesApi(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      );

      const { requestParams } = buildSearchSpacesRequestParams({
        accessToken: resolved.rawAccessToken,
        spaceIds: context.propsValue['spaceIds'],
        spaceManifests: context.propsValue['spaceManifests'],
        page: context.propsValue['page'],
        perPage: context.propsValue['perPage'],
        locales: context.propsValue['locales'],
      });

      const result = await client.searchSpaces(
        asSpacesApiSearchSpacesRequest(requestParams)
      );
      return response((result.data ?? {}) as unknown as Record<string, unknown>);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
