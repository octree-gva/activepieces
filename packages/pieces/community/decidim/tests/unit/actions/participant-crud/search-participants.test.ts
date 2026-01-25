import { searchParticipants } from '../../../../src/lib/actions/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import { UsersApi, OAuthApi } from '@octree/decidim-sdk';

jest.mock('@octree/decidim-sdk', () => {
  const actual = jest.requireActual('@octree/decidim-sdk');
  return {
    ...actual,
    OAuthApi: jest.fn(),
    UsersApi: jest.fn(),
  };
});

jest.mock('../../../../src/lib/utils/systemAccessToken', () => ({
  systemAccessToken: jest.fn().mockResolvedValue('system-token'),
}));

describe('searchParticipants', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersApi = {
      users: jest.fn().mockResolvedValue({ data: { data: [] } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({}));
  });

  it('should return participants matching extended data query', async () => {
    const mockUsers = [{ id: 1, nickname: 'user1' }, { id: 2, nickname: 'user2' }];
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: mockUsers } });

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

    expect(mockUsersApi.users).toHaveBeenCalledWith({
      filterExtendedDataCont: '{"chatbotID": "31"}',
      perPage: 100,
    });
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
