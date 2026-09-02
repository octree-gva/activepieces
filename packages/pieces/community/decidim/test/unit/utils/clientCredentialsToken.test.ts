import { vi } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import { fetchDecidimClientCredentialsToken } from '../../../src/lib/utils/clientCredentialsToken';

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

describe('fetchDecidimClientCredentialsToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRequest.mockReset();
  });

  it('sends space-separated scopes on the token request', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'token' },
    });

    const token = await fetchDecidimClientCredentialsToken({
      baseUrl: 'https://example.decidim.com/',
      clientId: 'id',
      clientSecret: 'secret',
      scopes: 'public oauth',
    });

    expect(token).toBe('token');
    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: HttpMethod.POST,
        url: 'https://example.decidim.com/oauth/token',
        body: 'grant_type=client_credentials&client_id=id&client_secret=secret&scope=public+oauth',
      })
    );
  });

  it('omits scope when it is not set', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'token' },
    });

    await fetchDecidimClientCredentialsToken({
      baseUrl: 'https://example.decidim.com',
      clientId: 'id',
      clientSecret: 'secret',
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'grant_type=client_credentials&client_id=id&client_secret=secret',
      })
    );
  });
});
