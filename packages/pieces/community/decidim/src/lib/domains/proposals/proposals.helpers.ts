import { z } from 'zod';
import type {
  ProposalsApiCastProposalVoteRequest,
  ProposalsApiGetProposalRequest,
  ProposalsApiListProposalsRequest,
} from '@octree/decidim-sdk';
import {
  normalizePagePerPage,
  parseOptionalPositiveInt,
  resolveListOrder,
} from '../blogs/blog-posts.helpers';
import { bearerAuthorization } from '../../runtime/authMode';

export function buildProposalsListRequest(args: {
  accessToken: string;
  searchOptions: Record<string, unknown>;
}): { request: ProposalsApiListProposalsRequest; effectivePerPage: number } {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const componentId = parseOptionalPositiveInt('Component ID', args.searchOptions['componentId']);
  const { page, effectivePerPage } = normalizePagePerPage(
    args.searchOptions['page'],
    args.searchOptions['perPage']
  );
  const sort = resolveListOrder(args.searchOptions);
  const unvoted = args.searchOptions['unvoted'] === true;

  const request: ProposalsApiListProposalsRequest = {
    authorization: auth,
    page,
    perPage: effectivePerPage,
    ...(componentId !== undefined ? { componentId } : {}),
    ...sort,
    ...(unvoted ? { filterVotedWeightBlank: true } : {}),
  };

  return { request, effectivePerPage };
}

export function buildProposalReadRequest(args: {
  accessToken: string;
  readOptions: Record<string, unknown>;
}): ProposalsApiGetProposalRequest {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const id = z.number().int().positive().parse(args.readOptions['proposalId']);

  const readReq: ProposalsApiGetProposalRequest = {
    id,
    authorization: auth,
  };
  return readReq;
}

export function buildVoteProposalRequest(args: {
  accessToken: string;
  voteOptions: Record<string, unknown>;
}): ProposalsApiCastProposalVoteRequest {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const o = args.voteOptions;
  const proposal_id = z.number().int().positive().parse(o['proposalId']);
  const weight = z.number().parse(o['voteWeight']);

  return {
    authorization: auth,
    voteProposalCreateBody: {
      proposal_id,
      data: { weight },
    },
  };
}
