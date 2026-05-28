import { z } from 'zod';
import type {
  ComponentsApiListBlogComponentsRequest,
  ComponentsApiListProposalComponentsRequest,
  ComponentsApiShowBlogComponentRequest,
  ComponentsApiShowProposalComponentRequest,
  ShowBlogComponentSpaceManifestEnum,
} from '@octree/decidim-sdk';
import { parseLocales } from '../../runtime/locales';
import { parseOptionalSpaceManifest } from '../blogs/blog-posts.helpers';

export function buildBlogComponentsListParams(args: {
  authorization: string;
  page: number;
  perPage: number;
  listOptions: Record<string, unknown>;
}): ComponentsApiListBlogComponentsRequest {
  const o = args.listOptions;
  const manifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceIdRaw = o['spaceId'];
  const spaceId =
    spaceIdRaw != null && spaceIdRaw !== ''
      ? z.number().int().positive().parse(spaceIdRaw)
      : undefined;

  return {
    authorization: args.authorization,
    page: args.page,
    perPage: args.perPage,
    locales: parseLocales(o['locales']),
    ...(manifest !== undefined ? { filterParticipatorySpaceTypeEq: manifest } : {}),
    ...(spaceId !== undefined ? { filterParticipatorySpaceIdEq: String(spaceId) } : {}),
  };
}

export function buildProposalComponentsListParams(args: {
  authorization: string;
  page: number;
  perPage: number;
  listOptions: Record<string, unknown>;
}): ComponentsApiListProposalComponentsRequest {
  const o = args.listOptions;
  const manifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceIdRaw = o['spaceId'];
  const spaceId =
    spaceIdRaw != null && spaceIdRaw !== ''
      ? z.number().int().positive().parse(spaceIdRaw)
      : undefined;

  return {
    authorization: args.authorization,
    page: args.page,
    perPage: args.perPage,
    locales: parseLocales(o['locales']),
    ...(manifest !== undefined ? { filterParticipatorySpaceTypeEq: manifest } : {}),
    ...(spaceId !== undefined ? { filterParticipatorySpaceIdEq: String(spaceId) } : {}),
  };
}

export function buildBlogComponentReadParams(args: {
  authorization: string;
  componentId: number;
  readOptions: Record<string, unknown>;
}): ComponentsApiShowBlogComponentRequest {
  const o = args.readOptions;
  const manifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceIdRaw = o['spaceId'];
  const spaceId =
    spaceIdRaw != null && spaceIdRaw !== ''
      ? z.number().int().positive().parse(spaceIdRaw)
      : undefined;

  return {
    id: args.componentId,
    authorization: args.authorization,
    locales: parseLocales(o['locales']),
    ...(manifest !== undefined
      ? { spaceManifest: manifest as ShowBlogComponentSpaceManifestEnum }
      : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
  };
}

export function buildProposalComponentReadParams(args: {
  authorization: string;
  componentId: number;
  readOptions: Record<string, unknown>;
}): ComponentsApiShowProposalComponentRequest {
  const o = args.readOptions;
  return {
    id: args.componentId,
    authorization: args.authorization,
    locales: parseLocales(o['locales']),
  };
}
