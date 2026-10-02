import { vi, type Mock } from 'vitest';
import { readParticipant } from '../../../../src/lib/domains/users/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import axios from 'axios';
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

const mockIsAxiosError = vi.spyOn(axios, 'isAxiosError');

describe('readParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false);
    mockUsersApi = {
      getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
      listUsers: vi.fn().mockResolvedValue({ data: { data: [] } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should return participant data and user info', async () => {
    const mockUserData = { chatbotID: '31' };
    const mockUsersBody = { data: [{ id: 123, nickname: 'testuser' }] };
    mockUsersApi.getUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: mockUserData } });
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: mockUsersBody });

    const result = await readParticipant(config, 'clientId', 'clientSecret', {
      readOptions: { userId: '123' },
    });

    expect(result.ok).toBe(true);
    expect(result.extended_data).toEqual({ data: mockUserData });
    expect(result.users).toEqual(mockUsersBody);
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('user');
    expect(result).not.toHaveProperty('data');
  });

  it('should return null extended_data when not found (404)', async () => {
    const mockUsersBody = { data: [{ id: 123, nickname: 'testuser' }] };
    const axiosError = {
      response: { status: 404 },
      isAxiosError: true,
    };
    mockIsAxiosError.mockReturnValue(true);
    mockUsersApi.getUserExtendedData = vi.fn().mockRejectedValue(axiosError);
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: mockUsersBody });

    const result = await readParticipant(config, 'clientId', 'clientSecret', {
      readOptions: { userId: '123' },
    });

    expect(result.ok).toBe(true);
    expect(result.extended_data).toBeNull();
    expect(result.users).toEqual(mockUsersBody);
  });

  it('should throw non-404 errors', async () => {
    const axiosError = {
      response: { status: 500 },
      isAxiosError: true,
    };
    mockIsAxiosError.mockReturnValue(true);
    mockUsersApi.getUserExtendedData = vi.fn().mockRejectedValue(axiosError);

    await expect(
      readParticipant(config, 'clientId', 'clientSecret', {
        readOptions: { userId: '123' },
      })
    ).rejects.toEqual(axiosError);
  });

  it('should require userId', async () => {
    await expect(
      readParticipant(config, 'clientId', 'clientSecret', {
        readOptions: {},
      })
    ).rejects.toThrow('User ID is required for read');
  });
});
