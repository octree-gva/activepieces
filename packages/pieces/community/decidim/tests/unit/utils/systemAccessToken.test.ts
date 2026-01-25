import { systemAccessToken } from '../../../src/lib/utils/systemAccessToken';
import { OAuthApi } from '@octree/decidim-sdk';

describe('systemAccessToken', () => {
  const mockOAuthApi = {
    createToken: jest.fn(),
  } as unknown as OAuthApi;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return access_token from response', async () => {
    (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({
      data: {
        access_token: 'test-token',
        token_type: 'Bearer' as const,
        expires_in: 3600,
        scope: 'oauth',
        created_at: Date.now(),
      },
    });

    const result = await systemAccessToken(mockOAuthApi, 'client-id', 'client-secret');

    expect(result).toBe('test-token');
    expect(mockOAuthApi.createToken).toHaveBeenCalledWith({
      oauthGrantParam: {
        grant_type: 'client_credentials',
        client_id: 'client-id',
        client_secret: 'client-secret',
        scope: 'oauth',
      },
    });
  });

  it('should propagate errors', async () => {
    const error = new Error('Network error');
    (mockOAuthApi.createToken as jest.Mock).mockRejectedValue(error);

    await expect(systemAccessToken(mockOAuthApi, 'client-id', 'client-secret')).rejects.toThrow('Network error');
  });
});
