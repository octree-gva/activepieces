import { z } from 'zod';
import type {
  BlogsApiGetBlogPostRequest,
  BlogsApiListBlogPostsRequest,
} from '@octree/decidim-sdk';
import { bearerAuthorization } from '../../runtime/authMode';
import { asBlogsApiBlogRequest, asBlogsApiBlogsRequest } from '../../runtime/sdk-casts';

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

export function parseRequiredPositiveInt(label: string, value: unknown): number {
  const n = parseOptionalPositiveInt(label, value);
  if (n === undefined) {
    throw new Error(`${label} is required`);
  }
  return n;
}

export function buildBlogsListRequest(args: {
  accessToken: string;
  searchOptions: Record<string, unknown>;
}): { request: BlogsApiListBlogPostsRequest; effectivePerPage: number } {
  const auth = bearerAuthorization(z.string().min(1).parse(args.accessToken));
  const componentId = parseRequiredPositiveInt('Component ID', args.searchOptions['componentId']);
  const { page, effectivePerPage } = normalizePagePerPage(undefined, undefined);

  const request = asBlogsApiBlogsRequest({
    authorization: auth,
    page,
    perPage: effectivePerPage,
    componentId,
  });

  return { request, effectivePerPage };
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
