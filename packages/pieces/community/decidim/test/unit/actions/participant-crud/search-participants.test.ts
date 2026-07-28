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
      listUsers: vi.fn().mockResolvedValue({ data: { data: [] } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({}));
  });

  it('maps user ids and nicknames', async () => {
    const mockUsers = [{ id: 1, nickname: 'user1' }];
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: mockUsers } });

    const result = await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: {
        userIds: [{ value: 1 }, { value: 2 }],
        nicknames: [{ value: 'alice' }, { value: 'bob' }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.users).toEqual(mockUsers);
    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer system-token',
        filterIdIn: [1, 2],
        filterNicknameIn: ['alice', 'bob'],
        perPage: 100,
      })
    );
  });

  it('maps single nickname to eq', async () => {
    await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: {
        nicknames: [{ value: 'alice' }],
      },
    });

    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        filterNicknameEq: 'alice',
      })
    );
  });

  it('maps extended data key/value to Cont query', async () => {
    await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: {
        extendedDataFilters: [
          { key: 'details.phone_number', value: '+41918477641' },
        ],
      },
    });

    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        filterExtendedDataCont: '{"details": {"phone_number": "+41918477641"}}',
      })
    );
  });

  it('returns empty results when no matches', async () => {
    const result = await searchParticipants(config, 'clientId', 'clientSecret', {
      searchOptions: {
        userIds: [{ value: 99 }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.users).toEqual([]);
    expect(result.count).toBe(0);
  });
});
