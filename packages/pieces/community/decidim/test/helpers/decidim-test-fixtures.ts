import { AppConnectionType } from '@activepieces/pieces-framework';
import type { DecidimAccessToken } from '../../src/types';

/** Shared CUSTOM_AUTH used across Decidim integration tests. */
export const decidimCustomAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    baseUrl: 'https://example.decidim.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
} as const;

/** Stable OAuth token shape for mocks and expected outputs. */
export const sampleDecidimAccessToken: DecidimAccessToken = {
  access_token: 'test-access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'oauth',
  created_at: Date.now(),
};
