/**
 * Small shared shapes for Decidim JSON:API responses and OAuth.
 * Prefer SDK-generated types for request parameters when they exist.
 */

export type DecidimSingleResource<T> = {
  data?: T;
};

export type DecidimResourceList<T> = {
  data?: T[];
};

/** Subset of OAuth token JSON from POST /oauth/token */
export type OAuthAccessTokenBody = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  created_at?: number;
};

/** Arbitrary JSON object (extended_data, custom payloads). */
export type JsonObject = Record<string, unknown>;
