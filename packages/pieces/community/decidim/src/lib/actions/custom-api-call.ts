import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
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

export function resolveCustomApiRequestUrl(input: {
  auth: unknown;
  propsValue?: Record<string, unknown>;
  url: string;
}): string {
  if (input.url.startsWith('http://') || input.url.startsWith('https://')) {
    return input.url;
  }
  const baseUrl = resolveCustomApiBaseUrl(input.auth, input.propsValue);
  if (!(baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
    return input.url;
  }
  return joinBaseUrlWithRelativePath({
    baseUrl,
    relativePath: input.url,
  });
}

export const customApiCallAction = createDecidimCustomApiCallAction();

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

function createDecidimCustomApiCallAction() {
  const stock = createCustomApiCallAction({
    auth: decidimAuth,
    name: 'custom_api_call',
    displayName: 'Custom API Call',
    description:
      'Send an authenticated request to your Decidim REST API. Authorization defaults to the connection token; override the Authorization header to use another token.',
    baseUrl: () => '',
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
      return customApiCallAuthHeaders({
        auth,
        propsValue,
        headers: propsValue.headers,
      });
    },
  });

  return createAction({
    auth: decidimAuth,
    name: stock.name,
    displayName: stock.displayName,
    description: stock.description,
    requireAuth: stock.requireAuth,
    audience: stock.audience,
    classification: stock.classification,
    props: stock.props,
    run: async (context) => stock.run(withAbsoluteCustomApiUrl(context)),
  });
}

function withAbsoluteCustomApiUrl<
  T extends { auth: unknown; propsValue: Record<string, unknown> },
>(context: T): T {
  const urlValue = readUrlValue(context.propsValue.url);
  if (urlValue === undefined) {
    return context;
  }
  const absolute = resolveCustomApiRequestUrl({
    auth: context.auth,
    propsValue: context.propsValue,
    url: urlValue,
  });
  if (absolute === urlValue) {
    return context;
  }
  return {
    ...context,
    propsValue: {
      ...context.propsValue,
      url: { url: absolute },
    },
  };
}

function joinBaseUrlWithRelativePath(input: {
  baseUrl: string;
  relativePath: string;
}): string {
  const baseUrlWithSlash = input.baseUrl.endsWith('/')
    ? input.baseUrl
    : `${input.baseUrl}/`;
  const relativePathWithoutSlash = input.relativePath.startsWith('/')
    ? input.relativePath.slice(1)
    : input.relativePath;
  return `${baseUrlWithSlash}${relativePathWithoutSlash}`;
}

function readUrlValue(urlBag: unknown): string | undefined {
  if (typeof urlBag === 'string') {
    return urlBag;
  }
  if (!isRecord(urlBag)) {
    return undefined;
  }
  const url = urlBag.url;
  return typeof url === 'string' ? url : undefined;
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
