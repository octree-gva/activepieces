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
    const mockUser = { id: 123, nickname: 'testuser' };
    mockUsersApi.getUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: mockUserData } });
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [mockUser] } });

    const result = await readParticipant(config, 'clientId', 'clientSecret', {
      readOptions: { userId: '123' },
    });

    expect(result.ok).toBe(true);
    expect(result.userId).toBe('123');
    expect(result.data).toEqual(mockUserData);
    expect(result.user).toEqual(mockUser);
  });

  it('should return null data when userData not found (404)', async () => {
    const mockUser = { id: 123, nickname: 'testuser' };
    const axiosError = {
      response: { status: 404 },
      isAxiosError: true,
    };
    mockIsAxiosError.mockReturnValue(true);
    mockUsersApi.getUserExtendedData = vi.fn().mockRejectedValue(axiosError);
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [mockUser] } });

    const result = await readParticipant(config, 'clientId', 'clientSecret', {
      readOptions: { userId: '123' },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
    expect(result.user).toEqual(mockUser);
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
