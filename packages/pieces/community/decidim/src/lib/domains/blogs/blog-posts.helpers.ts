import { z } from 'zod';
import type {
  BlogsApiGetBlogPostRequest,
  BlogsApiListBlogPostsRequest,
} from '@octree/decidim-sdk';
import { bearerAuthorization } from '../../runtime/authMode';
import { asBlogsApiBlogRequest, asBlogsApiBlogsRequest } from '../../runtime/sdk-casts';
import { computeHasMore } from '../components/search-component.helpers';

export { bearerAuthorization } from '../../runtime/authMode';

const spaceManifestEnum = z.enum([
  'participatory_processes',
  'assemblies',
  'conferences',
  'initiatives',
]);

const listSortEnum = z.enum(['published_at:asc', 'published_at:desc', 'rand']);

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

export function parseRequiredPositiveInt(label: string, value: unknown): number {
  const n = parseOptionalPositiveInt(label, value);
  if (n === undefined) {
    throw new Error(`${label} is required`);
  }
  return n;
}

export function resolveListOrder(searchOptions: Record<string, unknown>): {
  order?: 'published_at' | 'rand';
  orderDirection?: 'asc' | 'desc';
} {
  const raw = searchOptions['order'];
  if (raw === undefined || raw === null || raw === '') {
    const direction = searchOptions['orderDirection'];
    if (direction === 'asc' || direction === 'desc') {
      return { orderDirection: direction };
    }
    return {};
  }

  if (raw === 'published_at' || raw === 'rand') {
    const direction = searchOptions['orderDirection'];
    return {
      order: raw,
      ...(direction === 'asc' || direction === 'desc' ? { orderDirection: direction } : {}),
    };
  }

  const value = listSortEnum.parse(raw);
  if (value === 'rand') {
    return { order: 'rand' };
  }
  if (value === 'published_at:asc') {
    return { order: 'published_at', orderDirection: 'asc' };
  }
  return { order: 'published_at', orderDirection: 'desc' };
}

export function buildBlogsListRequest(args: {
  accessToken: string;
  searchOptions: Record<string, unknown>;
}): { request: BlogsApiListBlogPostsRequest; effectivePerPage: number } {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const componentId = parseOptionalPositiveInt('Component ID', args.searchOptions['componentId']);
  const { page, effectivePerPage } = normalizePagePerPage(
    args.searchOptions['page'],
    args.searchOptions['perPage']
  );
  const sort = resolveListOrder(args.searchOptions);

  const request = asBlogsApiBlogsRequest({
    authorization: auth,
    page,
    perPage: effectivePerPage,
    ...(componentId !== undefined ? { componentId } : {}),
    ...sort,
  });

  return { request, effectivePerPage };
}

export function blogSearchPayload(args: {
  body: unknown;
  effectivePerPage: number;
}): Record<string, unknown> {
  const base = plainObject(args.body);
  const list = Array.isArray(base['data']) ? base['data'] : [];
  const meta = plainObject(base['meta']);
  const links = plainObject(base['links']);

  const count = parseOptionalNonNegativeInt(meta['count']) ?? list.length;
  const has_more = Boolean(links['next']) || computeHasMore(list.length, args.effectivePerPage);

  return {
    ...base,
    count,
    has_more,
  };
}

export function buildBlogReadRequest(args: {
  accessToken: string;
  readOptions: Record<string, unknown>;
}): BlogsApiGetBlogPostRequest {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const id = z.number().int().positive('Blog post ID must be > 0').parse(args.readOptions['blogPostId']);

  return asBlogsApiBlogRequest({
    id,
    authorization: auth,
  });
}

function plainObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}

function parseOptionalNonNegativeInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.trunc(n);
}
