import { httpClient, HttpMethod } from '@activepieces/pieces-common';

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
    body: tokenRequestBody(auth),
  });
  const token = response.body?.access_token;
  if (!token) {
    throw new Error('Decidim OAuth response did not include access_token');
  }
  return token;
}

function tokenRequestBody(auth: DecidimConnectionAuth): string {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });
  if (auth.scopes) {
    params.set('scope', auth.scopes);
  }
  return params.toString();
}

type DecidimConnectionAuth = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
};
