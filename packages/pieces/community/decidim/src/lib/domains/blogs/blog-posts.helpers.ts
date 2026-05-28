import { z } from 'zod';
import type {
  BlogsApiGetBlogPostRequest,
  BlogsApiListBlogPostsRequest,
} from '@octree/decidim-sdk';
import { bearerAuthorization } from '../../runtime/authMode';
import { asBlogsApiBlogRequest, asBlogsApiBlogsRequest } from '../../runtime/sdk-casts';
import { parseLocales } from '../../runtime/locales';

export { bearerAuthorization } from '../../runtime/authMode';

const spaceManifestEnum = z.enum([
  'participatory_processes',
  'assemblies',
  'conferences',
  'initiatives',
]);

export function normalizePagePerPage(
  page: unknown,
  perPage: unknown
): { page: number; effectivePerPage: number } {
  const p = z.number().int().min(1).default(1).parse(page ?? 1);
  const pp = z.number().int().min(1).max(100).default(50).parse(perPage ?? 50);
  return { page: p, effectivePerPage: pp };
}

export function parseOptionalSpaceManifest(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return spaceManifestEnum.parse(value);
}

export function parseOptionalPositiveInt(label: string, value: unknown) {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Math.trunc(n);
}

export function parseOptionalOrder(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

export function parseOptionalOrderDirection(
  value: unknown
): 'asc' | 'desc' | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return z.enum(['asc', 'desc']).parse(value);
}

export function buildBlogsListRequest(args: {
  accessToken: string;
  searchOptions: Record<string, unknown>;
}): { request: BlogsApiListBlogPostsRequest; effectivePerPage: number } {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const o = args.searchOptions;
  const { page, effectivePerPage } = normalizePagePerPage(
    o['page'],
    o['perPage']
  );

  const spaceManifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceId = parseOptionalPositiveInt('Space ID', o['spaceId']);
  const componentId = parseOptionalPositiveInt('Component ID', o['componentId']);
  const order = parseOptionalOrder(o['order']);
  const orderDirection = parseOptionalOrderDirection(o['orderDirection']);

  const request = asBlogsApiBlogsRequest({
    authorization: auth,
    page,
    perPage: effectivePerPage,
    locales: parseLocales(o['locales']),
    ...(spaceManifest !== undefined ? { spaceManifest } : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
    ...(componentId !== undefined ? { componentId } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(orderDirection !== undefined ? { orderDirection } : {}),
  });

  return { request, effectivePerPage };
}

export function buildBlogReadRequest(args: {
  accessToken: string;
  readOptions: Record<string, unknown>;
}): BlogsApiGetBlogPostRequest {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const o = args.readOptions;
  const id = z.number().int().positive('Blog post ID must be > 0').parse(o['blogPostId']);

  const spaceManifest = parseOptionalSpaceManifest(o['spaceManifest']);
  const spaceId = parseOptionalPositiveInt('Space ID', o['spaceId']);
  const componentId = parseOptionalPositiveInt('Component ID', o['componentId']);
  const order = parseOptionalOrder(o['order']);
  const orderDirection = parseOptionalOrderDirection(o['orderDirection']);

  return asBlogsApiBlogRequest({
    id,
    authorization: auth,
    locales: parseLocales(o['locales']),
    ...(spaceManifest !== undefined ? { spaceManifest } : {}),
    ...(spaceId !== undefined ? { spaceId } : {}),
    ...(componentId !== undefined ? { componentId } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(orderDirection !== undefined ? { orderDirection } : {}),
  });
}
