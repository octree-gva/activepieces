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
  hostProp,
  blogOrderProp,
  decidimComponentIdProp,
  pageProp,
  perPageProp,
  proposalIdProp,
  unvotedProp,
  userAccessTokenProp,
  voteWeightProp,
} from '../../props';
import {
  buildProposalReadRequest,
  buildProposalsListRequest,
  buildVoteProposalRequest,
} from './proposals.helpers';

export const proposals = createAction({
  name: 'proposals',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Proposal',
  description:
    'Search, read, or vote on published proposals. Use User access token for participant-scoped operations.',
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
          { label: 'Vote', value: 'vote' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search Options',
      description: 'Options for searching proposals',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'search') return {};
        return {
          componentId: decidimComponentIdProp(false),
          page: pageProp(false),
          perPage: perPageProp(false),
          order: blogOrderProp(false),
          unvoted: unvotedProp(false),
        };
      },
    }),
    readOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Read Options',
      description: 'Options for reading a proposal',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'read') return {};
        return {
          proposalId: proposalIdProp(true),
        };
      },
    }),
    voteOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Vote Options',
      description: 'Options for voting on a proposal',
      required: false,
      refreshers: ['action'],
      props: async ({ action }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (action !== 'vote') return {};
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
        const { request } = buildProposalsListRequest({
          accessToken: resolved.rawAccessToken,
          searchOptions: o,
        });

        const result = await api.listProposals(request);
        return response(result.data as unknown as Record<string, unknown>);
      }

      if (action === 'read') {
        const o = (context.propsValue.readOptions as Record<string, unknown>) || {};
        const readReq = buildProposalReadRequest({
          accessToken: resolved.rawAccessToken,
          readOptions: o,
        });
        const result = await api.getProposal(readReq);
        return response(result.data as unknown as Record<string, unknown>);
      }

      if (action === 'vote') {
        const o = (context.propsValue.voteOptions as Record<string, unknown>) || {};
        const voteReq = buildVoteProposalRequest({
          accessToken: resolved.rawAccessToken,
          voteOptions: o,
        });
        const result = await api.castProposalVote(voteReq);
        return response(result.data as unknown as Record<string, unknown>);
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
