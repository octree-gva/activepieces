import { z } from 'zod';
import type {
  ListProposalsOrderEnum,
  ProposalsApiCastProposalVoteRequest,
  ProposalsApiGetProposalRequest,
  ProposalsApiListProposalsRequest,
} from '@octree/decidim-sdk';
import { parseLocales } from '../../runtime/locales';
import {
  normalizePagePerPage,
  parseOptionalOrderDirection,
  parseOptionalPositiveInt,
  parseOptionalSpaceManifest,
} from '../blogs/blog-posts.helpers';
import { bearerAuthorization } from '../../runtime/authMode';

function parseOptionalProposalsOrder(value: unknown): ListProposalsOrderEnum | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return z.enum(['published_at', 'rand']).parse(value) as ListProposalsOrderEnum;
}

export function buildProposalsListRequest(args: {
  accessToken: string;
  searchOptions: Record<string, unknown>;
}): { request: ProposalsApiListProposalsRequest; effectivePerPage: number } {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const o = args.searchOptions;
  const { page, effectivePerPage } = normalizePagePerPage(o['page'], o['perPage']);

  const spaceManifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceId = parseOptionalPositiveInt('Space ID', o['spaceId']);
  const componentId = parseOptionalPositiveInt('Component ID', o['componentId']);
  const order = parseOptionalProposalsOrder(o['order']);
  const orderDirection = parseOptionalOrderDirection(o['orderDirection']);

  const request: ProposalsApiListProposalsRequest = {
    authorization: auth,
    page,
    perPage: effectivePerPage,
    locales: parseLocales(o['locales']),
    ...(spaceManifest !== undefined ? { spaceManifest } : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
    ...(componentId !== undefined ? { componentId } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(orderDirection !== undefined ? { orderDirection } : {}),
  };

  return { request, effectivePerPage };
}

export function buildProposalReadRequest(args: {
  accessToken: string;
  readOptions: Record<string, unknown>;
}): ProposalsApiGetProposalRequest {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const o = args.readOptions;
  const id = z.number().int().positive().parse(o['proposalId']);

  const spaceManifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceId = parseOptionalPositiveInt('Space ID', o['spaceId']);
  const componentId = parseOptionalPositiveInt('Component ID', o['componentId']);
  const order = parseOptionalProposalsOrder(o['order']);
  const orderDirection = parseOptionalOrderDirection(o['orderDirection']);

  const readReq: ProposalsApiGetProposalRequest = {
    id,
    authorization: auth,
    locales: parseLocales(o['locales']),
    ...(spaceManifest !== undefined ? { spaceManifest } : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
    ...(componentId !== undefined ? { componentId } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(orderDirection !== undefined ? { orderDirection } : {}),
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
