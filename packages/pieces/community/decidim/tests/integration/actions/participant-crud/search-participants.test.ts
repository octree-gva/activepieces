import { participantCrud } from '../../../../src/lib/actions/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';

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

type SearchResult = Response<{ users: any[]; count: number }>;

const mockAuth = {
  baseUrl: 'https://example.decidim.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};

const mockUsersApi = {
  users: jest.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'search';
  searchOptions: { extendedDataQuery: string };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: mockAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Search Participants Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({}));
  });

  it('should return matching participants', async () => {
    const mockUsers = [
      { id: 1, nickname: 'user1', email: 'user1@example.com' },
      { id: 2, nickname: 'user2', email: 'user2@example.com' },
    ];
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: mockUsers } });

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: { extendedDataQuery: '{"chatbotID": "31"}' },
    })) as SearchResult;

    expect(result.ok).toBe(true);
    expect(result.users).toEqual(mockUsers);
    expect(result.count).toBe(2);
  });

  it('should return empty results when no matches found', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: { extendedDataQuery: '{"key": "value"}' },
    })) as SearchResult;

    expect(result.ok).toBe(true);
    expect(result.users).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should normalize JSON query formatting', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });

    await participantCrud.run(createContext({
      action: 'search',
      searchOptions: { extendedDataQuery: '{"chatbotID":"31"}' },
    }));

    expect(mockUsersApi.users).toHaveBeenCalledWith({
      filterExtendedDataCont: '{"chatbotID": "31"}',
      perPage: 100,
    });
  });

  it('should handle API errors', async () => {
    const axiosError = {
      response: { status: 500, data: { error: 'Server error' } },
      message: 'Internal server error',
      isAxiosError: true,
    };
    mockUsersApi.users = jest.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'search',
      searchOptions: { extendedDataQuery: '{"key": "value"}' },
    })) as SearchResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
