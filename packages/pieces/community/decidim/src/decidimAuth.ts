import { PieceAuth, Property } from "@activepieces/pieces-framework";
import { fetchDecidimClientCredentialsToken } from "./lib/utils/clientCredentialsToken";

export const decidimAuth = PieceAuth.CustomAuth({
  description: 'Enter your Decidim OAuth application credentials',
  props: {
    name: Property.ShortText({
      displayName: 'Name',
      required: true,
      description: 'OAuth application name from Decidim admin (OAuth applications).',
    }),
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
    scopes: Property.ShortText({
      displayName: 'Scopes',
      required: true,
      defaultValue: 'oauth',
      description: 'Space-separated OAuth scopes, for example public system or public oauth whatsapp.',
    }),
  },
  getConnectionIdentifier: async ({ auth }) => {
    const name = auth.name.trim();
    return name === '' ? undefined : name;
  },
  validate: async ({ auth }) => {
    try {
      await fetchDecidimClientCredentialsToken({
        baseUrl: auth.baseUrl,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        scopes: auth.scopes,
      });
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Invalid Base URL, Client ID, Client Secret or Scopes',
      };
    }
  },
  required: true,
});
