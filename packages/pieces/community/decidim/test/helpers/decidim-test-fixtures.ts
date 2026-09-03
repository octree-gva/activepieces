import { AppConnectionType } from '@activepieces/pieces-framework';
import type { DecidimAccessToken } from '../../src/types';

/** Shared CUSTOM_AUTH used across Decidim integration tests. */
export const decidimCustomAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'Test OAuth app',
    tenants: JSON.stringify({
      'https://example.decidim.com': {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        scopes: 'oauth',
      },
    }),
  },
} as const;

export const decidimTestHost = 'https://example.decidim.com';

/** Stable OAuth token shape for mocks and expected outputs. */
export const sampleDecidimAccessToken: DecidimAccessToken = {
  access_token: 'test-access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'oauth',
  created_at: Date.now(),
};
