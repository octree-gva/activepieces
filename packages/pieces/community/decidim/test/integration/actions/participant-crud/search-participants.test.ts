import { vi, type Mock } from 'vitest';
import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../../helpers/decidim-test-fixtures';

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

type SearchResult = Response<{ users: unknown[]; count: number }>;

const mockUsersApi = {
  listUsers: vi.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'search';
  searchOptions: Record<string, unknown>;
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: decidimCustomAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Search Participants Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({}));
  });

  it('should return matching participants', async () => {
    const mockUsers = [
      { id: 1, nickname: 'user1', email: 'user1@example.com' },
      { id: 2, nickname: 'user2', email: 'user2@example.com' },
    ];
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: mockUsers } });

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: {
        extendedDataFilters: [
          { key: 'chatbotID', value: '31' },
        ],
      },
    })) as SearchResult;

    expect(result.ok).toBe(true);
    expect(result.users).toEqual(mockUsers);
    expect(result.count).toBe(2);
  });

  it('should return empty results when no matches found', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: {
        userIds: [{ value: 99 }],
      },
    })) as SearchResult;

    expect(result.ok).toBe(true);
    expect(result.users).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should map extended data filter to Cont query', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });

    await participantCrud.run(createContext({
      action: 'search',
      searchOptions: {
        extendedDataFilters: [
          { key: 'chatbotID', value: '31' },
        ],
      },
    }));

    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer system-token',
        filterExtendedDataCont: '{"chatbotID": "31"}',
        perPage: 100,
      })
    );
  });

  it('should handle API errors', async () => {
    const axiosError = {
      response: { status: 500, data: { error: 'Server error' } },
      message: 'Internal server error',
      isAxiosError: true,
    };
    mockUsersApi.listUsers = vi.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: {
        nicknames: [{ value: 'alice' }],
      },
    })) as SearchResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
