import { PieceAuth, Property } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod } from "@activepieces/pieces-common";

export const decidimAuth = PieceAuth.CustomAuth({
  description: 'Enter your Decidim client credentials',
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Base URL',
      required: true,
      description: 'Decidim instance base URL (e.g., https://example.com)',
    }),
    clientId: PieceAuth.SecretText({
      displayName: 'Client ID',
      required: true,
    }),
    clientSecret: PieceAuth.SecretText({
      displayName: 'Client Secret',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    try {
      const response = await httpClient.sendRequest({
        method: HttpMethod.POST,
        url: `${auth.baseUrl}/oauth/token`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: auth.clientId,
          client_secret: auth.clientSecret,
        }).toString(),
      });
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Invalid Base URL, Client ID or Client Secret',
      };
    }
  },
  required: true,
});
