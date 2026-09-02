import {
  createAction,
  Property,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { assertProp } from '../../utils/assertProp';
import { resolveAuthContext, bearerAuthorization } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createDraftProposalsApi, createProposalsApi } from '../../runtime/clients';
import { decidimComponentIdProp, draftProposalIdProp, userAccessTokenProp } from '../../props';
import type {
  DraftProposalsApiCreateDraftProposalRequest,
  DraftProposalsApiGetDraftProposalRequest,
  DraftProposalsApiPublishDraftProposalRequest,
  DraftProposalsApiUpdateDraftProposalRequest,
  DraftProposalsApiWithdrawDraftProposalRequest,
} from '@octree/decidim-sdk';
import {
  buildCreateDraftProposalPayload,
  draftProposalsUserTokenError,
  parseDraftProposalId,
  parseDraftUpdateBody,
  parseRequiredComponentId,
  unpublishedDrafts,
} from './draft-proposals.helpers';
import { buildProposalsListRequest } from './proposals.helpers';

export const draftProposals = createAction({
  name: 'draftProposals',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Draft proposal',
  description:
    'Search, create, read, update, withdraw, or publish draft proposals. Requires a user access token (e.g. from Impersonate).',
  props: {
    accessToken: userAccessTokenProp(false),
    connectionSetup: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Connection',
      required: false,
      refreshers: ['auth'],
      props: async ({ auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (auth) return {};
        return {
          connectionHint: Property.MarkDown({
            value:
              '**Connection required.** Add a valid Decidim connection for this step so dependent fields (components, draft IDs, dropdowns) can load.',
          }),
        };
      },
    }),
    action: Property.StaticDropdown({
      displayName: 'Action',
      description: 'The action to perform',
      required: true,
      options: {
        options: [
          { label: 'Search', value: 'search' },
          { label: 'Create', value: 'create' },
          { label: 'Read', value: 'read' },
          { label: 'Update', value: 'update' },
          { label: 'Withdraw', value: 'withdraw' },
          { label: 'Publish', value: 'publish' },
        ],
      },
    }),
    searchOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Search Options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'search') return {};
        return { componentId: decidimComponentIdProp(true) };
      },
    }),
    createOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Create Options',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'create') return {};
        return { componentId: decidimComponentIdProp(true) };
      },
    }),
    idOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Draft id',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth) return {};
        if (action === 'create' || action === 'search') return {};
        return { draftProposalId: draftProposalIdProp(true) };
      },
    }),
    updateOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Update payload',
      required: false,
      refreshers: ['action', 'auth'],
      props: async ({ action, auth }: Record<string, unknown>): Promise<InputPropertyMap> => {
        if (!auth || action !== 'update') return {};
        return {
          body: Property.Json({
            displayName: 'Update body',
            required: true,
            description: '{ "title"?, "body"?, "locale"? }',
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
      if (resolved.mode === 'system') {
        return response({}, draftProposalsUserTokenError());
      }

      const api = createDraftProposalsApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const authHeader = bearerAuthorization(resolved.rawAccessToken);
      const action = context.propsValue.action;

      if (action === 'search') {
        const o = (context.propsValue.searchOptions as Record<string, unknown>) || {};
        assertProp(o.componentId, 'component_id is required');
        parseRequiredComponentId(o.componentId);
        const proposalsApi = createProposalsApi(
          resolved.baseConfiguration,
          resolved.rawAccessToken
        );
        const { request } = buildProposalsListRequest({
          accessToken: resolved.rawAccessToken,
          searchOptions: o,
        });
        const result = await proposalsApi.listProposals(request);
        const list = (result.data as { data?: unknown[] })?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const drafts = unpublishedDrafts(arr);
        return response({
          drafts,
          count: drafts.length,
          auth_mode: resolved.mode,
        });
      }

      if (action === 'create') {
        const o = (context.propsValue.createOptions as Record<string, unknown>) || {};
        assertProp(o.componentId, 'component_id is required');
        const component_id = z.number().int().positive().parse(o.componentId);
        const createReq: DraftProposalsApiCreateDraftProposalRequest = {
          authorization: authHeader,
          createDraftProposalPayload: buildCreateDraftProposalPayload(component_id),
        };
        const result = await api.createDraftProposal(createReq);
        const data = (result.data as { data?: { id?: string } })?.data;
        return response({
          draft: data,
          draft_proposal_id: data?.id,
          access_token: resolved.rawAccessToken,
          auth_mode: resolved.mode,
        });
      }

      const idOpts = (context.propsValue.idOptions as Record<string, unknown>) || {};
      assertProp(idOpts.draftProposalId, 'Draft proposal ID is required');
      const id = parseDraftProposalId(idOpts.draftProposalId);

      if (action === 'read') {
        const readReq: DraftProposalsApiGetDraftProposalRequest = {
          id,
          authorization: authHeader,
        };
        const result = await api.getDraftProposal(readReq);
        const data = (result.data as { data?: unknown })?.data;
        return response({
          draft: data,
          draft_proposal_id: data && typeof data === 'object' && data !== null && 'id' in data
            ? String((data as { id: string }).id)
            : String(id),
          auth_mode: resolved.mode,
        });
      }

      if (action === 'update') {
        const u = (context.propsValue.updateOptions as Record<string, unknown>) || {};
        assertProp(u.body, 'Update body is required');
        const body = await parseDraftUpdateBody(u.body);
        const updateReq: DraftProposalsApiUpdateDraftProposalRequest = {
          id,
          authorization: authHeader,
          updateDraftProposalPayload: { data: body },
        };
        const result = await api.updateDraftProposal(updateReq);
        return response({
          draft: (result.data as { data?: unknown })?.data,
          draft_proposal_id: String(id),
          auth_mode: resolved.mode,
        });
      }

      if (action === 'withdraw') {
        const withdrawReq: DraftProposalsApiWithdrawDraftProposalRequest = {
          id,
          authorization: authHeader,
        };
        await api.withdrawDraftProposal(withdrawReq);
        return response({ withdrew: true, draft_proposal_id: String(id), auth_mode: resolved.mode });
      }

      if (action === 'publish') {
        const publishReq: DraftProposalsApiPublishDraftProposalRequest = {
          id,
          authorization: authHeader,
        };
        const result = await api.publishDraftProposal(publishReq);
        const data = (result.data as { data?: unknown })?.data;
        return response({
          proposal: data,
          proposal_id:
            data && typeof data === 'object' && data !== null && 'id' in data
              ? String((data as { id: string }).id)
              : undefined,
          draft_proposal_id: String(id),
          auth_mode: resolved.mode,
        });
      }

      return response({}, `Unknown action: ${String(action)}`);
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
