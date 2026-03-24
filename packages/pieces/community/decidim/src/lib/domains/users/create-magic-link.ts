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
      displayName: 'redirect_url',
      required: true,
      description: 'URL the user is sent to after sign-in (OpenAPI request body data.redirect_url).',
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
        redirectUrl: z.string().min(1),
      });

      const api = createUsersApi(resolved.baseConfiguration, resolved.rawAccessToken);
      const authHeader = bearerAuthorization(resolved.rawAccessToken);
      const magicReq: UsersApiGenerateMagicLinkRequest = {
        authorization: authHeader,
        generateMagicLinkPayload: {
          data: { redirect_url: context.propsValue.redirectUrl.trim() },
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
        redirectUrl: context.propsValue.redirectUrl.trim(),
        access_token: resolved.rawAccessToken,
        auth_mode: resolved.mode,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
