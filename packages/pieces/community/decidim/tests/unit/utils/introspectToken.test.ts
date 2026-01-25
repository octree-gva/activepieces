import { introspectToken } from '../../../src/lib/utils/introspecToken';
import { OAuthApi } from '@octree/decidim-sdk';

describe('introspectToken', () => {
  const mockOAuthApi = {
    introspectToken: jest.fn(),
  } as unknown as OAuthApi;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return token data when token is active', async () => {
    const mockTokenData = {
      active: true,
      sub: 'user-123',
      exp: Date.now() / 1000 + 3600,
      resource: { id: 'user-123', name: 'Test User' },
    };

    (mockOAuthApi.introspectToken as jest.Mock).mockResolvedValue({
      data: mockTokenData,
    });

    const result = await introspectToken(mockOAuthApi, 'test-token', 'system-token');

    expect(result).toEqual(mockTokenData);
    expect(mockOAuthApi.introspectToken).toHaveBeenCalledWith(
      { introspectToken: { token: 'test-token' } },
      { headers: { Authorization: 'Bearer system-token' } }
    );
  });

  it('should return null when token is inactive', async () => {
    (mockOAuthApi.introspectToken as jest.Mock).mockResolvedValue({
      data: { active: false },
    });

    const result = await introspectToken(mockOAuthApi, 'inactive-token', 'system-token');

    expect(result).toBeNull();
  });

  it('should return null when active is explicitly false', async () => {
    (mockOAuthApi.introspectToken as jest.Mock).mockResolvedValue({
      data: { active: false, sub: 'user-123' },
    });

    const result = await introspectToken(mockOAuthApi, 'token', 'system-token');

    expect(result).toBeNull();
  });

  it('should propagate errors', async () => {
    const error = new Error('Invalid token');
    (mockOAuthApi.introspectToken as jest.Mock).mockRejectedValue(error);

    await expect(introspectToken(mockOAuthApi, 'invalid-token', 'system-token')).rejects.toThrow('Invalid token');
  });
});
