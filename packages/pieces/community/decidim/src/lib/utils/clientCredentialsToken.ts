import { httpClient, HttpMethod } from '@activepieces/pieces-common';

type DecidimConnectionAuth = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

/**
 * OAuth2 client_credentials access token for the Decidim instance (same flow as connection validation).
 */
export async function fetchDecidimClientCredentialsToken(
  auth: DecidimConnectionAuth
): Promise<string> {
  const response = await httpClient.sendRequest<{
    access_token?: string;
  }>({
    method: HttpMethod.POST,
    url: `${auth.baseUrl.replace(/\/$/, '')}/oauth/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    }).toString(),
  });
  const token = response.body?.access_token;
  if (!token) {
    throw new Error('Decidim OAuth response did not include access_token');
  }
  return token;
}
