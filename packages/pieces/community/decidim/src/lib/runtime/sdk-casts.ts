/**
 * Bridge validated runtime values to @octree/decidim-sdk request/response types.
 * The OpenAPI client often types response `data` as void or request params too narrowly; we assert after Zod / props validation.
 */

import type {
  BlogsApiBlogRequest,
  BlogsApiBlogsRequest,
  ComponentsApiSearchComponentsRequest,
  CreateRoleRequest,
  SpacesApiSearchSpacesRequest,
  UpdateOrganizationPayload,
  UsersApiSetUserDataRequest,
  UsersApiUserDataRequest,
  UsersApiUsersRequest,
} from '@octree/decidim-sdk';
import type { DecidimAccessToken } from '../../types';
import type { OAuthAccessTokenBody } from '../types/decidim-api';

export function oauthTokenBodyFromResponse(data: unknown): OAuthAccessTokenBody {
  return data as OAuthAccessTokenBody;
}

export function decidimAccessTokenFromResponse(data: unknown): DecidimAccessToken {
  return data as DecidimAccessToken;
}

export function asUsersApiUsersRequest(payload: unknown): UsersApiUsersRequest {
  return payload as UsersApiUsersRequest;
}

export function asUsersApiSetUserDataRequest(payload: unknown): UsersApiSetUserDataRequest {
  return payload as UsersApiSetUserDataRequest;
}

export function asUsersApiUserDataRequest(payload: unknown): UsersApiUserDataRequest {
  return payload as UsersApiUserDataRequest;
}

export function asSpacesApiSearchSpacesRequest(payload: unknown): SpacesApiSearchSpacesRequest {
  return payload as SpacesApiSearchSpacesRequest;
}

export function asComponentsApiSearchComponentsRequest(
  payload: unknown
): ComponentsApiSearchComponentsRequest {
  return payload as ComponentsApiSearchComponentsRequest;
}

export function asBlogsApiBlogsRequest(payload: unknown): BlogsApiBlogsRequest {
  return payload as BlogsApiBlogsRequest;
}

export function asBlogsApiBlogRequest(payload: unknown): BlogsApiBlogRequest {
  return payload as BlogsApiBlogRequest;
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

/** JSON:API-style envelope `{ data?: { ... } }` on generateMagicLink (and similar) responses. */
export function magicLinkResultResourceData(data: unknown): Record<string, unknown> | undefined {
  const envelope = data as { data?: Record<string, unknown> };
  return envelope?.data;
}
