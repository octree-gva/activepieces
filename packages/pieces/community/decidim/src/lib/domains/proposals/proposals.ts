import {
  createAction,
  Property,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createProposalsApi } from '../../runtime/clients';
import {
  blogOrderDirectionProp,
  decidimComponentIdProp,
  decidimSpaceIdProp,
  decidimSpaceManifestProp,
  localesProp,
  pageProp,
  perPageProp,
  proposalIdProp,
  proposalOrderProp,
  userAccessTokenProp,
  voteWeightProp,
} from '../../props';
import { computeHasMore } from '../components/search-component.helpers';
import {
  buildProposalReadRequest,
  buildProposalsListRequest,
  buildVoteProposalRequest,
} from './proposals.helpers';

export const proposals = createAction({
  name: 'proposals',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Proposals',
  description:
    'List, read, or vote on published proposals. Use User access token for participant-scoped operations.',
  props: {
    accessToken: userAccessTokenProp(false),
    action: Property.StaticDropdown({
      displayName: 'Action',
      required: true,
      options: {
        options: [
          { label: 'Search (list)', value: 'search' },
          { label: 'Read', value: 'read' },
          { label: 'Vote', value: 'vote' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'search') return {};
        return {
          page: pageProp(false),
          perPage: perPageProp(false),
          locales: localesProp(false),
          spaceManifest: decidimSpaceManifestProp(false),
          spaceId: decidimSpaceIdProp(false),
          componentId: decidimComponentIdProp(false),
          order: proposalOrderProp(false),
          orderDirection: blogOrderDirectionProp(false),
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
          proposalId: proposalIdProp(true),
          locales: localesProp(false),
          spaceManifest: decidimSpaceManifestProp(false),
          spaceId: decidimSpaceIdProp(false),
          componentId: decidimComponentIdProp(false),
          order: proposalOrderProp(false),
          orderDirection: blogOrderDirectionProp(false),
        };
      },
    }),
    voteOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Vote options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'vote') return {};
        return {
          proposalId: proposalIdProp(true),
          voteWeight: voteWeightProp(true),
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
      const api = createProposalsApi(resolved.baseConfiguration, resolved.rawAccessToken);

      const action = context.propsValue.action;

      if (action === 'search') {
        const o = (context.propsValue.searchOptions as Record<string, unknown>) || {};
        const { request, effectivePerPage } = buildProposalsListRequest({
          accessToken: resolved.rawAccessToken,
          searchOptions: o,
        });

        const result = await api.proposals(request);

        const list = (result.data as { data?: unknown[] })?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return response({
          proposals: arr,
          count: arr.length,
          has_more: computeHasMore(arr.length, effectivePerPage),
          auth_mode: resolved.mode,
        });
      }

      if (action === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        const readReq = buildProposalReadRequest({
          accessToken: resolved.rawAccessToken,
          readOptions: o,
        });
        const result = await api.proposal(readReq);
        const data = (result.data as { data?: unknown })?.data;
        const rid =
          data && typeof data === 'object' && data !== null && 'id' in data
            ? String((data as { id: string }).id)
            : undefined;
        return response({
          proposal: data,
          proposal_id: rid,
          auth_mode: resolved.mode,
        });
      }

      if (action === 'vote') {
        const o = (context.propsValue.voteOptions as Record<string, unknown>) || {};
        const voteReq = buildVoteProposalRequest({
          accessToken: resolved.rawAccessToken,
          voteOptions: o,
        });
        const result = await api.voteProposal(voteReq);
        const proposal_id = voteReq.voteAProposalPayload.proposal_id;
        return response({
          data: result.data,
          proposal_id: String(proposal_id),
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
