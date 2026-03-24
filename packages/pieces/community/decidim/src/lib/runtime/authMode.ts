import { z } from 'zod';
import { OAuthApi } from '@octree/decidim-sdk';
import { configuration } from '../utils/configuration';
import { systemAccessToken } from '../utils/systemAccessToken';

export type AuthResolutionMode = 'user' | 'system';

export type ResolvedAuthContext = {
  /** `Authorization` header value, always `Bearer …` */
  authorization: string;
  /** Token string without `Bearer ` prefix (for SDK `accessToken` option) */
  rawAccessToken: string;
  mode: AuthResolutionMode;
  oauthApi: OAuthApi;
  /** Base SDK configuration (no accessToken yet) */
  baseConfiguration: ReturnType<typeof configuration>;
};

/**
 * Normalize to a value suitable for the `Authorization` HTTP header.
 */
export function bearerAuthorization(rawToken: string): string {
  const token = z.string().min(1).parse(rawToken);
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function stripBearer(token: string): string {
  return token.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Optional prop from a previous step (e.g. Impersonate). Whitespace-only counts as unset.
 */
export function parseOptionalUserAccessToken(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/**
 * Piece auth gives client credentials. If `props.accessToken` is set, use it as resource-owner / impersonation token; otherwise client-credentials `oauth` scope.
 */
export async function resolveAuthContext(args: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Typical key: `accessToken` from optional Property.ShortText on an action */
  props?: Record<string, unknown>;
  accessTokenPropKey?: string;
}): Promise<ResolvedAuthContext> {
  const key = args.accessTokenPropKey ?? 'accessToken';
  const userRaw = parseOptionalUserAccessToken(args.props?.[key]);
  const baseConfiguration = configuration({ baseUrl: args.baseUrl });
  const oauthApi = new OAuthApi(baseConfiguration);

  let rawAccessToken: string;
  let mode: AuthResolutionMode;

  if (userRaw !== undefined) {
    rawAccessToken = stripBearer(userRaw);
    if (!rawAccessToken) {
      throw new Error('accessToken prop is empty');
    }
    mode = 'user';
  } else {
    rawAccessToken = await systemAccessToken(
      oauthApi,
      args.clientId,
      args.clientSecret
    );
    mode = 'system';
  }

  return {
    authorization: bearerAuthorization(rawAccessToken),
    rawAccessToken,
    mode,
    oauthApi,
    baseConfiguration,
  };
}
