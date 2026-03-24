import { createAction } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
import { decidimAuth } from '../../../decidimAuth';
import { extractAuth } from '../../utils/auth';
import { response } from '../../utils/response';
import { resolveAuthContext } from '../../runtime/authMode';
import { getErrorMessage } from '../../runtime/errors';
import { createOAuthApiWithAccessToken } from '../../runtime/clients';
import type { OAuthApiIntrospectTokenRequest } from '@octree/decidim-sdk';
import { tokenToIntrospectProp, userAccessTokenProp } from '../../props';

export const oauthIntrospect = createAction({
  name: 'oauthIntrospect',
  auth: decidimAuth,
  requireAuth: true,
  displayName: 'OAuth introspect',
  description:
    'RFC 7662 token introspection. Uses piece credentials to authorize the introspection request.',
  props: {
    accessToken: userAccessTokenProp(false),
    tokenToIntrospect: tokenToIntrospectProp(true),
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
      const oauthApi = createOAuthApiWithAccessToken(
        resolved.baseConfiguration,
        resolved.rawAccessToken
      );
      const raw = context.propsValue.tokenToIntrospect;
      await propsValidation.validateZod({ raw }, { raw: z.string().min(1) });
      const token = String(raw).trim().replace(/^Bearer\s+/i, '');
      const introspectReq: OAuthApiIntrospectTokenRequest = {
        introspectToken: { token },
      };
      const result = await oauthApi.introspectToken(introspectReq);
      return response({
        introspection: result.data,
        auth_mode: resolved.mode,
      });
    } catch (e) {
      return response({}, getErrorMessage(e));
    }
  },
});
