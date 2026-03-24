import { OAuthApi } from '@octree/decidim-sdk';
import { decidimAccessTokenFromResponse } from '../runtime/sdk-casts';

export async function systemAccessToken(
  oauthApi: OAuthApi,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const systemAccessResponse = await oauthApi.createToken({
    oauthGrantParam: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'oauth',
    },
  });
  const token = decidimAccessTokenFromResponse(systemAccessResponse.data);
  return token.access_token;
}
