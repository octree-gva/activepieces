import { readParticipant } from '../../../../src/lib/actions/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import axios from 'axios';
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

const mockIsAxiosError = jest.spyOn(axios, 'isAxiosError');

describe('readParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false);
    mockUsersApi = {
      userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
      users: jest.fn().mockResolvedValue({ data: { data: [] } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should return participant data and user info', async () => {
    const mockUserData = { chatbotID: '31' };
    const mockUser = { id: 123, nickname: 'testuser' };
    mockUsersApi.userData = jest.fn().mockResolvedValue({ data: { data: mockUserData } });
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [mockUser] } });

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
    mockUsersApi.userData = jest.fn().mockRejectedValue(axiosError);
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [mockUser] } });

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
    mockUsersApi.userData = jest.fn().mockRejectedValue(axiosError);

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
