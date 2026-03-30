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
import { createDraftProposalsApi } from '../../runtime/clients';
import { decidimComponentIdProp, draftProposalIdProp, userAccessTokenProp } from '../../props';
import type {
  DraftProposalsApiCreateDraftProposalRequest,
  DraftProposalsApiDraftProposalRequest,
  DraftProposalsApiPublishDraftProposalRequest,
  DraftProposalsApiUpdateDraftProposalRequest,
  DraftProposalsApiWithdrawDraftProposalRequest,
} from '@octree/decidim-sdk';
import {
  buildCreateDraftProposalPayload,
  draftProposalsUserTokenError,
  parseDraftProposalId,
  parseDraftUpdateBody,
} from './draft-proposals.helpers';

export const draftProposals = createAction({
  name: 'draftProposals',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Draft proposals',
  description:
    'Create, read, update, withdraw, or publish draft proposals. Requires a user access token (e.g. from Impersonate).',
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
      required: true,
      options: {
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Read', value: 'read' },
          { label: 'Update', value: 'update' },
          { label: 'Withdraw', value: 'withdraw' },
          { label: 'Publish', value: 'publish' },
        ],
      },
    }),
    createOptions: Property.DynamicProperties({
      auth: decidimAuth,
      displayName: 'Create options',
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
        if (action === 'create') return {};
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
        const readReq: DraftProposalsApiDraftProposalRequest = {
          id,
          authorization: authHeader,
        };
        const result = await api.draftProposal(readReq);
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
