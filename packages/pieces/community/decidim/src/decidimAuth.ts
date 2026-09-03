import { PieceAuth, Property } from "@activepieces/pieces-framework";
import { fetchDecidimClientCredentialsToken } from "./lib/utils/clientCredentialsToken";
import {
  parseTenantsJson,
  readConnectionProps,
} from "./lib/utils/tenantPack";

const tenantsMarkdown = `
Paste a JSON object keyed by Decidim instance URL. Each value needs client_id, client_secret, and scopes.

\`\`\`json
{
  "https://participate.city.fr": {
    "client_id": "...",
    "client_secret": "...",
    "scopes": "oauth"
  }
}
\`\`\`

On save, every host is checked with a client-credentials token request. Existing single-host connections must be recreated in this format.
`;

export const decidimAuth = PieceAuth.CustomAuth({
  description: 'Enter a tenant pack of Decidim OAuth credentials (one JSON map for all hosts).',
  props: {
    name: Property.ShortText({
      displayName: 'Name',
      required: true,
      description: 'Label for this connection (shown in the connections list).',
    }),
    tenants: Property.LongText({
      displayName: 'Tenants JSON',
      required: true,
      description: tenantsMarkdown,
    }),
  },
  getConnectionIdentifier: async ({ auth }) => {
    const name = auth.name.trim();
    return name === '' ? undefined : name;
  },
  validate: async ({ auth }) => {
    try {
      const connection = readConnectionProps(auth);
      const tenants = parseTenantsJson(connection.tenants);
      const failures: string[] = [];
      for (const [host, entry] of Object.entries(tenants)) {
        try {
          await fetchDecidimClientCredentialsToken({
            baseUrl: host,
            clientId: entry.client_id,
            clientSecret: entry.client_secret,
            scopes: entry.scopes,
          });
        } catch {
          failures.push(`${host}: invalid credentials`);
        }
      }
      if (failures.length > 0) {
        return {
          valid: false,
          error: failures.join('; '),
        };
      }
      return { valid: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid tenants JSON';
      return {
        valid: false,
        error: message,
      };
    }
  },
  required: true,
});
