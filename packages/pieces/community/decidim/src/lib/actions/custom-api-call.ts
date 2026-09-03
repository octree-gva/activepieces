import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { decidimAuth } from '../../decidimAuth';
import { hostProp } from '../props';
import { extractAuth } from '../utils/auth';
import { fetchDecidimClientCredentialsToken } from '../utils/clientCredentialsToken';

export function resolveCustomApiBaseUrl(
  auth: unknown,
  propsValue?: Record<string, unknown>
): string {
  if (!auth) {
    throw new Error('Decidim connection is required');
  }
  if (!propsValue?.host) {
    return '';
  }
  return extractAuth({ auth, propsValue }).baseUrl.replace(/\/$/, '');
}

export const customApiCallAction = createCustomApiCallAction({
  auth: decidimAuth,
  name: 'custom_api_call',
  displayName: 'Custom API Call',
  description:
    'Send an authenticated request to your Decidim REST API. Authorization defaults to the connection token; override the Authorization header to use another token.',
  baseUrl: (auth, propsValue) => resolveCustomApiBaseUrl(auth, propsValue),
  extraProps: {
    host: hostProp(),
  },
  props: {
    headers: {
      defaultValue: {
        Authorization: '',
      },
      description:
        'Authorization defaults to the Bearer token from this connection. Set Authorization to override it (for example a token from Get Token or Impersonate).',
    },
  },
  authMapping: async (auth, propsValue) => {
    if (!auth) {
      throw new Error('Decidim connection is required');
    }
    return customApiCallAuthHeaders({ auth, propsValue, headers: propsValue.headers });
  },
});

export async function customApiCallAuthHeaders(input: {
  auth: unknown;
  propsValue?: Record<string, unknown>;
  headers: unknown;
}): Promise<Record<string, string>> {
  const userAuthorization = headerValue(input.headers, 'Authorization');
  if (userAuthorization) {
    return { Accept: 'application/json' };
  }
  const { baseUrl, clientId, clientSecret, scopes } = extractAuth({
    auth: input.auth,
    propsValue: input.propsValue,
  });
  const accessToken = await fetchDecidimClientCredentialsToken({
    baseUrl,
    clientId,
    clientSecret,
    scopes,
  });
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!isRecord(headers)) {
    return undefined;
  }
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== needle) {
      continue;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
