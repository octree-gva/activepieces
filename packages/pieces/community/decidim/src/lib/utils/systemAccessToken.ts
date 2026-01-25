import { OAuthApi } from '@octree/decidim-sdk';
import { DecidimAccessToken } from '../../types';

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
  const token = systemAccessResponse.data as unknown as DecidimAccessToken;
  return token.access_token;
}
