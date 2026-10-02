/**
 * Bridge validated runtime values to @octree/decidim-sdk request/response types.
 * The OpenAPI client often types response `data` as void or request params too narrowly; we assert after Zod / props validation.
 */

import type {
  BlogsApiBlogShowPaginationRequest,
  BlogsApiListBlogPostsRequest,
  ComponentsApiSearchComponentsRequest,
  CreateRoleRequest,
  SpacesApiSearchSpacesRequest,
  UpdateOrganizationPayload,
  UsersApiGetUserExtendedDataRequest,
  UsersApiListUsersRequest,
  UsersApiSetUserExtendedDataRequest,
} from '@octree/decidim-sdk';
import type { DecidimAccessToken } from '../../types';
import type { OAuthAccessTokenBody } from '../types/decidim-api';

export function oauthTokenBodyFromResponse(data: unknown): OAuthAccessTokenBody {
  return data as OAuthAccessTokenBody;
}

export function decidimAccessTokenFromResponse(data: unknown): DecidimAccessToken {
  return data as DecidimAccessToken;
}

export function asUsersApiUsersRequest(payload: unknown): UsersApiListUsersRequest {
  return payload as UsersApiListUsersRequest;
}

export function asUsersApiSetUserDataRequest(payload: unknown): UsersApiSetUserExtendedDataRequest {
  return payload as UsersApiSetUserExtendedDataRequest;
}

export function asUsersApiUserDataRequest(payload: unknown): UsersApiGetUserExtendedDataRequest {
  return payload as UsersApiGetUserExtendedDataRequest;
}

export function asSpacesApiSearchSpacesRequest(payload: unknown): SpacesApiSearchSpacesRequest {
  return payload as SpacesApiSearchSpacesRequest;
}

export function asComponentsApiSearchComponentsRequest(
  payload: unknown
): ComponentsApiSearchComponentsRequest {
  return payload as ComponentsApiSearchComponentsRequest;
}

export function asBlogsApiBlogsRequest(payload: unknown): BlogsApiListBlogPostsRequest {
  return payload as BlogsApiListBlogPostsRequest;
}

export function asBlogsApiBlogRequest(payload: unknown): BlogsApiBlogShowPaginationRequest {
  return payload as BlogsApiBlogShowPaginationRequest;
}

export function updateOrganizationPayloadFromRecord(
  payload: Record<string, unknown>
): UpdateOrganizationPayload {
  return payload as unknown as UpdateOrganizationPayload;
}

export function createRoleRequestBodyFromRecord(
  payload: Record<string, unknown>
): CreateRoleRequest {
  return payload as unknown as CreateRoleRequest;
}

export function asResponseRecord(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}
