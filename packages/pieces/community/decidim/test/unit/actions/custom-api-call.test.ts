import { vi } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import {
  customApiCallAction,
  customApiCallAuthHeaders,
} from '../../../src/lib/actions/custom-api-call';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

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

describe('customApiCallAuthHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRequest.mockReset();
  });

  it('uses Authorization from headers and does not mint a token', async () => {
    const headers = await customApiCallAuthHeaders({
      auth: decidimCustomAuth,
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
      headers: {},
    });

    expect(headers.Authorization).toBe('Bearer connection-token');
  });
});

describe('customApiCallAction', () => {
  it('pre-fills an Authorization header key', () => {
    expect(customApiCallAction.props.headers.defaultValue).toEqual({
      Authorization: '',
    });
  });
});
