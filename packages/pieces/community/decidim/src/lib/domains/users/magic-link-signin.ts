import { createAction, Property } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { bearerAuthorization, parseOptionalUserAccessToken } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createUsersApi } from '../../runtime/clients';
import { configuration } from '../../utils/configuration';
import { UsersApi, type UsersApiMagicLinkSigninRequest } from '@octree/decidim-sdk';

type MagicLinkSignInHttpOptions = Parameters<UsersApi['magicLinkSignin']>[1];

/**
 * GET /me/magic_links/{magic_token} — challengers session / redirect.
 * Uses connection base URL; optional bearer if your instance expects it.
 */
export const magicLinkSignin = createAction({
  name: 'magicLinkSignin',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'Magic link sign-in',
  description:
    'GET /me/magic_links/{magic_token}. Does not follow redirects so you can inspect status and Location.',
  props: {
    magicToken: Property.ShortText({
      displayName: 'magic_token',
      required: true,
      description: 'Token from create magic link response (attributes.token).',
    }),
    bearerOptional: Property.ShortText({
      displayName: 'Authorization (optional)',
      required: false,
      description: 'Rare: raw Bearer token if the instance requires it on this GET.',
    }),
  },
  async run(context) {
    try {
      const { baseUrl } = extractAuth(context);
      await propsValidation.validateZod(context.propsValue, {
        magicToken: z.string().min(1),
      });
      const token = context.propsValue.magicToken.trim();
      const manualBearer = parseOptionalUserAccessToken(context.propsValue.bearerOptional);

      const baseConfiguration = configuration({ baseUrl });
      const api =
        manualBearer !== undefined
          ? createUsersApi(baseConfiguration, manualBearer.replace(/^Bearer\s+/i, '').trim())
          : new UsersApi(baseConfiguration);
      const authOpt =
        manualBearer !== undefined ? bearerAuthorization(manualBearer) : undefined;

      const axiosOpts = {
        maxRedirects: 0,
        validateStatus: () => true,
      } as MagicLinkSignInHttpOptions;

      const signInReq: UsersApiMagicLinkSigninRequest = {
        magicToken: token,
        ...(authOpt ? { authorization: authOpt } : {}),
      };
      const result = await api.magicLinkSignin(signInReq, axiosOpts);

      const status = result.status;
      const location =
        result.headers &&
        typeof (result.headers as { location?: string }).location === 'string'
          ? (result.headers as { location: string }).location
          : undefined;

      return response({
        status,
        location,
        auth_mode: manualBearer !== undefined ? 'user' : 'none',
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
