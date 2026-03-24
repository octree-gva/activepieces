import { createAction } from '@activepieces/pieces-framework';
import type { SpacesApiSearchSpacesRequest } from '@octree/decidim-sdk';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import {
  decidimSpaceManifestProp,
  localesProp,
  perPageProp,
  spaceSearchAdvancedFiltersProp,
  spaceSearchMaxResultsProp,
  spaceSearchTitleQueryProp,
  userAccessTokenProp,
} from '../../props';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { asSpacesApiSearchSpacesRequest } from '../../runtime/sdk-casts';
import { createSpacesApi } from '../../runtime/clients';
import {
  buildSearchSpacesRequestParams,
  normalizeAdvancedFiltersInput,
  searchParticipatorySpacePropsSchema,
  type SearchParticipatorySpaceInput,
} from './spaces-search-params';

type SpacesClient = {
  searchSpaces: (req: SpacesApiSearchSpacesRequest) => Promise<unknown>;
};

function parseSearchParticipatoryProps(
  props: Record<string, unknown>
): SearchParticipatorySpaceInput {
  return searchParticipatorySpacePropsSchema.parse({
    query: props['query'],
    spaceType: props['spaceType'],
    advancedFilters: normalizeAdvancedFiltersInput(props['advancedFilters']),
    perPage: props['perPage'],
    maxResults: props['maxResults'],
  });
}

function readBatchFromSearchResult(result: unknown): unknown[] {
  const raw = (result as { data?: { data?: unknown } } | undefined)?.data?.data;
  return Array.isArray(raw) ? raw : [];
}

async function fetchSpacesPages(args: {
  client: SpacesClient;
  accessToken: string;
  input: SearchParticipatorySpaceInput;
  locales: unknown;
}): Promise<{ spaces: unknown[]; pagesFetched: number }> {
  const spaces: unknown[] = [];
  let page = 1;
  let pagesFetched = 0;

  while (spaces.length < args.input.maxResults) {
    const { requestParams, effectivePerPage } = buildSearchSpacesRequestParams({
      accessToken: args.accessToken,
      query: args.input.query,
      spaceType: args.input.spaceType,
      advancedFilters: args.input.advancedFilters,
      page,
      perPage: args.input.perPage,
      locales: args.locales,
    });

    const result = await args.client.searchSpaces(
      asSpacesApiSearchSpacesRequest(requestParams)
    );
    const batch = readBatchFromSearchResult(result);
    pagesFetched += 1;

    if (batch.length === 0) break;

    const room = args.input.maxResults - spaces.length;
    spaces.push(...batch.slice(0, room));

    if (batch.length < effectivePerPage) break;
    page += 1;
  }

  return { spaces, pagesFetched };
}

export const searchParticipatorySpace = createAction({
  auth: decidimAuth,
  name: 'searchParticipatorySpace',
  displayName: 'Search Participatory Space',
  description: 'Search assemblies, processes, conferences, or initiatives (with optional auto-pagination)',
  props: {
    accessToken: userAccessTokenProp(false),
    query: spaceSearchTitleQueryProp(false),
    spaceType: decidimSpaceManifestProp(false),
    advancedFilters: spaceSearchAdvancedFiltersProp(false),
    perPage: perPageProp(false),
    maxResults: spaceSearchMaxResultsProp(false),
    locales: localesProp(false),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const input = parseSearchParticipatoryProps(context.propsValue);

      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      const client = createSpacesApi(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      ) as SpacesClient;

      const { spaces, pagesFetched } = await fetchSpacesPages({
        client,
        accessToken: resolved.rawAccessToken,
        input,
        locales: context.propsValue['locales'],
      });

      return response({
        spaces,
        count: spaces.length,
        pagesFetched,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
