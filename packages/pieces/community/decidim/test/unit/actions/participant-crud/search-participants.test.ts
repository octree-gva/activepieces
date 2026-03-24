import { vi, type Mock } from 'vitest';
import { searchParticipants } from '../../../../src/lib/domains/users/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import { UsersApi, OAuthApi } from '@octree/decidim-sdk';

vi.mock('@octree/decidim-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@octree/decidim-sdk')>();
  return {
    ...actual,
    OAuthApi: vi.fn(),
    UsersApi: vi.fn(),
  };
});

vi.mock('../../../../src/lib/utils/systemAccessToken', () => ({
  systemAccessToken: vi.fn().mockResolvedValue('system-token'),
}));

describe('searchParticipants', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi = {
      users: vi.fn().mockResolvedValue({ data: { data: [] } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({}));
  });

  it('should return participants matching extended data query', async () => {
    const mockUsers = [{ id: 1, nickname: 'user1' }, { id: 2, nickname: 'user2' }];
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: mockUsers } });

    const result = await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: { extendedDataQuery: '{"chatbotID": "31"}' },
    });

    expect(result.ok).toBe(true);
    expect(result.users).toEqual(mockUsers);
    expect(result.count).toBe(2);
  });

  it('should normalize JSON query formatting', async () => {
    await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: { extendedDataQuery: '{"chatbotID":"31"}' },
    });

    expect(mockUsersApi.users).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer system-token',
        filterExtendedDataCont: '{"chatbotID": "31"}',
        perPage: 100,
      })
    );
  });

  it('should return empty results when no matches found', async () => {
    const result = await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: { extendedDataQuery: '{"key": "value"}' },
    });

    expect(result.ok).toBe(true);
    expect(result.users).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should require extendedDataQuery', async () => {
    await expect(
      searchParticipants(config, 'clientId', 'clientSecret', {
        searchOptions: {},
      })
    ).rejects.toThrow('Extended Data Query is required for search');
  });
});
