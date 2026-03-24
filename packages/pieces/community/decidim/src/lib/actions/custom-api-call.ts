import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { decidimAuth } from '../../decidimAuth';
import { extractAuth } from '../utils/auth';
import { fetchDecidimClientCredentialsToken } from '../utils/clientCredentialsToken';

export const customApiCallAction = createCustomApiCallAction({
  auth: decidimAuth,
  name: 'custom_api_call',
  displayName: 'Custom API Call',
  description:
    'Send an authenticated request to your Decidim instance (Bearer token from client credentials). Use a path like `/api/v1/...` or the full URL.',
  baseUrl: (auth) => {
    if (!auth) {
      throw new Error('Decidim connection is required');
    }
    return extractAuth({ auth }).baseUrl.replace(/\/$/, '');
  },
  authMapping: async (auth) => {
    if (!auth) {
      throw new Error('Decidim connection is required');
    }
    const { baseUrl, clientId, clientSecret } = extractAuth({ auth });
    const accessToken = await fetchDecidimClientCredentialsToken({
      baseUrl,
      clientId,
      clientSecret,
    });
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
  },
});
