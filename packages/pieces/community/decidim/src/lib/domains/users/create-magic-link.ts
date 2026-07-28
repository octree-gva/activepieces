import { createAction, Property } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { bearerAuthorization, resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { magicLinkResultResourceData } from '../../runtime/sdk-casts';
import { createUsersApi } from '../../runtime/clients';
import type { UsersApiGenerateMagicLinkRequest } from '@octree/decidim-sdk';
import { userAccessTokenProp } from '../../props';

/** Hostname: letters, digits, dots, hyphens, underscores (no IPv6). Userinfo rejected separately. */
const REDIRECT_HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
/** Path + query + hash: only a-z, A-Z, 0-9, ._-/?#= (no spaces, %, &, etc.). */
const REDIRECT_PATH_SEARCH_HASH_RE = /^\/[a-zA-Z0-9._\-/?#=]*$/;

function redirectUrlValidationMessage(trimmed: string): string | null {
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'redirect_url must be a valid URL';
  }
  if (url.protocol !== 'https:') {
    return 'redirect_url must use https';
  }
  if (url.username !== '' || url.password !== '') {
    return 'redirect_url must not include userinfo';
  }
  if (!REDIRECT_HOST_RE.test(url.hostname)) {
    return 'redirect_url host may only use letters, digits, dots, hyphens, and underscores';
  }
  const pathSearchHash = url.pathname + url.search + url.hash;
  if (!REDIRECT_PATH_SEARCH_HASH_RE.test(pathSearchHash)) {
    return 'redirect_url path and query may only use letters, digits, and ._-/?#=';
  }
  return null;
}

const redirectUrlSchema = z.string().optional().superRefine((val, ctx) => {
  if (val === undefined || val.trim() === '') {
    return;
  }
  const trimmed = val.trim();
  const msg = redirectUrlValidationMessage(trimmed);
  if (msg !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
  }
});

export const createMagicLink = createAction({
  name: 'createMagicLink',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Create magic link',
  description:
    'POST /me/magic_links (generateMagicLink). Requires a user access token (resource owner), e.g. from Impersonate.',
  props: {
    accessToken: userAccessTokenProp(true),
    redirectUrl: Property.ShortText({
      displayName: 'Redirect URL',
      required: false,
      description:
        'Optional. HTTPS URL sent to the API as data.redirect_url. Allowed characters: letters, digits, and ._-/?#= in path and query (no %, &, spaces, or other specials).',
    }),
  },
  async run(context) {
    try {
      const { baseUrl, clientId, clientSecret } = extractAuth(context);
      const resolved = await resolveAuthContext({
        baseUrl,
        clientId,
        clientSecret,
        props: context.propsValue,
      });
      if (resolved.mode === 'system') {
        return response(
          {},
          'Magic link creation requires a user access token. Set "User access token" (e.g. output from Impersonate).'
        );
      }

      await propsValidation.validateZod(context.propsValue, {
        redirectUrl: redirectUrlSchema,
      });

      const rawRedirect = context.propsValue.redirectUrl;
      const trimmedRedirect =
        typeof rawRedirect === 'string' && rawRedirect.trim() !== '' ? rawRedirect.trim() : undefined;

      const api = createUsersApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const authHeader = bearerAuthorization(resolved.rawAccessToken);
      const magicReq: UsersApiGenerateMagicLinkRequest = {
        authorization: authHeader,
        generateMagicLinkPayload: {
          data: trimmedRedirect ? { redirect_url: trimmedRedirect } : {},
        },
      };
      const result = await api.generateMagicLink(magicReq);

      const data = magicLinkResultResourceData(result.data);
      const attrs =
        data && typeof data === 'object' && data !== null && 'attributes' in data
          ? (data as { attributes?: { token?: string; label?: string } }).attributes
          : undefined;
      const links =
        data && typeof data === 'object' && data !== null && 'links' in data
          ? (data as { links?: { sign_in?: { href?: string } } }).links
          : undefined;
      const token = attrs?.token;
      const signInHref = links?.sign_in?.href;

      return response({
        magic_link: data,
        token,
        sign_in_url: signInHref,
        signInUrl: signInHref,
        ...(trimmedRedirect !== undefined ? { redirectUrl: trimmedRedirect } : {}),
        access_token: resolved.rawAccessToken,
        auth_mode: resolved.mode,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
