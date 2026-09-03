import { vi } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import {
  customApiCallAction,
  customApiCallAuthHeaders,
  resolveCustomApiBaseUrl,
} from '../../../src/lib/actions/custom-api-call';
import {
  decidimCustomAuth,
  decidimTestHost,
} from '../../helpers/decidim-test-fixtures';
import { AppConnectionType } from '@activepieces/pieces-framework';

const { sendRequest } = vi.hoisted(() => ({
  sendRequest: vi.fn(),
}));

vi.mock('@activepieces/pieces-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@activepieces/pieces-common')>();
  return {
    ...actual,
    httpClient: {
      sendRequest,
    },
  };
});

const secondHostAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'Multi',
    tenants: JSON.stringify({
      'https://example.decidim.com': {
        client_id: 'first-id',
        client_secret: 'first-secret',
        scopes: 'oauth',
      },
      'https://second.decidim.com': {
        client_id: 'second-id',
        client_secret: 'second-secret',
        scopes: 'public system',
      },
    }),
  },
} as const;

describe('customApiCallAuthHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRequest.mockReset();
  });

  it('uses Authorization from headers and does not mint a token', async () => {
    const headers = await customApiCallAuthHeaders({
      auth: decidimCustomAuth,
      propsValue: { host: decidimTestHost },
      headers: { Authorization: 'Bearer user-token' },
    });

    expect(headers).toEqual({ Accept: 'application/json' });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it('ignores a blank Authorization header and uses the connection token', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'connection-token' },
    });

    const headers = await customApiCallAuthHeaders({
      auth: decidimCustomAuth,
      propsValue: { host: decidimTestHost },
      headers: { Authorization: '  ' },
    });

    expect(headers).toEqual({
      Authorization: 'Bearer connection-token',
      Accept: 'application/json',
    });
    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: HttpMethod.POST,
        url: 'https://example.decidim.com/oauth/token',
        body: expect.stringContaining('scope=oauth'),
      })
    );
  });

  it('mints a connection token when Authorization is missing', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'connection-token' },
    });

    const headers = await customApiCallAuthHeaders({
      auth: decidimCustomAuth,
      propsValue: { host: decidimTestHost },
      headers: {},
    });

    expect(headers.Authorization).toBe('Bearer connection-token');
  });

  it('mints against the selected host credentials in a multi-tenant pack', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'second-token' },
    });

    await customApiCallAuthHeaders({
      auth: secondHostAuth,
      propsValue: { host: 'https://second.decidim.com' },
      headers: {},
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://second.decidim.com/oauth/token',
        body: expect.stringContaining('client_id=second-id'),
      })
    );
    expect(sendRequest.mock.calls[0][0].body).toContain('client_secret=second-secret');
    expect(sendRequest.mock.calls[0][0].body).toContain('scope=public+system');
  });

  it('does not mint first-host credentials when second host is selected', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'second-token' },
    });

    await customApiCallAuthHeaders({
      auth: secondHostAuth,
      propsValue: { host: 'https://second.decidim.com' },
      headers: {},
    });

    expect(sendRequest.mock.calls[0][0].body).not.toContain('client_id=first-id');
  });

  it('fails closed when host is missing', async () => {
    await expect(
      customApiCallAuthHeaders({
        auth: decidimCustomAuth,
        propsValue: {},
        headers: {},
      })
    ).rejects.toThrow('Platform host is required');
  });

  it('fails closed when host is unknown', async () => {
    await expect(
      customApiCallAuthHeaders({
        auth: decidimCustomAuth,
        propsValue: { host: 'https://missing.example' },
        headers: {},
      })
    ).rejects.toThrow('Unknown platform host: https://missing.example');
  });

  it('accepts case-insensitive Authorization header override', async () => {
    const headers = await customApiCallAuthHeaders({
      auth: decidimCustomAuth,
      propsValue: { host: decidimTestHost },
      headers: { authorization: 'Bearer lower' },
    });
    expect(headers).toEqual({ Accept: 'application/json' });
    expect(sendRequest).not.toHaveBeenCalled();
  });
});

describe('resolveCustomApiBaseUrl', () => {
  it('returns empty string when host is missing', () => {
    expect(resolveCustomApiBaseUrl(decidimCustomAuth, {})).toBe('');
  });

  it('throws when auth is missing', () => {
    expect(() =>
      resolveCustomApiBaseUrl(undefined, { host: decidimTestHost })
    ).toThrow('Decidim connection is required');
  });

  it('resolves the selected host without trailing slash', () => {
    expect(
      resolveCustomApiBaseUrl(secondHostAuth, {
        host: 'https://second.decidim.com/',
      })
    ).toBe('https://second.decidim.com');
  });

  it('fails closed on unknown host', () => {
    expect(() =>
      resolveCustomApiBaseUrl(decidimCustomAuth, {
        host: 'https://missing.example',
      })
    ).toThrow('Unknown platform host');
  });
});

describe('customApiCallAction', () => {
  it('pre-fills an Authorization header key', () => {
    expect(customApiCallAction.props.headers.defaultValue).toEqual({
      Authorization: '',
    });
  });

  it('exposes platform host as an extra prop', () => {
    expect(customApiCallAction.props.host).toBeDefined();
    expect(customApiCallAction.props.host.required).toBe(true);
    expect(customApiCallAction.props.host.displayName).toBe('Platform host');
  });

  it('requires auth', () => {
    expect(customApiCallAction.requireAuth).toBe(true);
  });
});
