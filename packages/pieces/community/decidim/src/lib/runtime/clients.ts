import type { Configuration } from '@octree/decidim-sdk';
import {
  BlogsApi,
  ComponentsApi,
  DraftProposalsApi,
  OAuthApi,
  OrganizationsApi,
  OrganizationsExtendedDataApi,
  ProposalsApi,
  RolesApi,
  SpacesApi,
  UsersApi,
} from '@octree/decidim-sdk';

type ClientConfig = Configuration & { accessToken: string };

function clientConfig(base: Configuration, rawAccessToken: string): ClientConfig {
  return {
    ...base,
    accessToken: rawAccessToken,
  } as ClientConfig;
}

export function createUsersApi(base: Configuration, rawAccessToken: string) {
  return new UsersApi(clientConfig(base, rawAccessToken));
}

export function createBlogsApi(base: Configuration, rawAccessToken: string) {
  return new BlogsApi(clientConfig(base, rawAccessToken));
}

export function createComponentsApi(base: Configuration, rawAccessToken: string) {
  return new ComponentsApi(clientConfig(base, rawAccessToken));
}

export function createSpacesApi(base: Configuration, rawAccessToken: string) {
  return new SpacesApi(clientConfig(base, rawAccessToken));
}

export function createProposalsApi(base: Configuration, rawAccessToken: string) {
  return new ProposalsApi(clientConfig(base, rawAccessToken));
}

export function createDraftProposalsApi(
  base: Configuration,
  rawAccessToken: string
) {
  return new DraftProposalsApi(clientConfig(base, rawAccessToken));
}

export function createOrganizationsApi(
  base: Configuration,
  rawAccessToken: string
) {
  return new OrganizationsApi(clientConfig(base, rawAccessToken));
}

export function createOrganizationsExtendedDataApi(
  base: Configuration,
  rawAccessToken: string
) {
  return new OrganizationsExtendedDataApi(clientConfig(base, rawAccessToken));
}

export function createRolesApi(base: Configuration, rawAccessToken: string) {
  return new RolesApi(clientConfig(base, rawAccessToken));
}

export function createOAuthApi(base: Configuration) {
  return new OAuthApi(base);
}

/** OAuth routes that need a caller Bearer (e.g. token introspection). */
export function createOAuthApiWithAccessToken(
  base: Configuration,
  rawAccessToken: string
) {
  return new OAuthApi(clientConfig(base, rawAccessToken));
}
