import { OAuthApi } from '@octree/decidim-sdk';

export async function introspectToken(
  oauthApi: OAuthApi,
  token: string,
  systemAccessToken: string
) {
  const tokenResponse =  await oauthApi.introspectToken({
    introspectToken: { token },
  }, {
    headers: {
      Authorization: `Bearer ${systemAccessToken}`,
    },
  });
  if(tokenResponse.data.active === false) {
    return null;
  }
  return tokenResponse.data
}
