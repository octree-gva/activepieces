import { createParticipant } from '../../../../src/lib/actions/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { createImpersonateToken, buildOAuthGrantParam } from '../../../../src/lib/actions/impersonate';
import { introspectToken } from '../../../../src/lib/utils/introspecToken';
import { readParticipant } from '../../../../src/lib/actions/participant-crud';

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

jest.mock('../../../../src/lib/actions/impersonate', () => ({
  createImpersonateToken: jest.fn(),
  buildOAuthGrantParam: jest.fn(),
}));

jest.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: jest.fn(),
}));

jest.mock('../../../../src/lib/actions/participant-crud', () => {
  const actual = jest.requireActual('../../../../src/lib/actions/participant-crud');
  return {
    ...actual,
    readParticipant: jest.fn(),
  };
});

describe('createParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;
  let mockOAuthApi: OAuthApi;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersApi = {
      users: jest.fn().mockResolvedValue({ data: { data: [] } }),
      userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
      setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    mockOAuthApi = {
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    } as unknown as OAuthApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => mockOAuthApi);
    (createImpersonateToken as jest.Mock).mockResolvedValue({ access_token: 'impersonate-token' });
    (buildOAuthGrantParam as jest.Mock).mockReturnValue({});
  });

  it('should create new participant when user does not exist', async () => {
    mockUsersApi.users = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [{ id: '456', nickname: 'newuser' }] } });
    (introspectToken as jest.Mock).mockResolvedValue({ resource: { id: '456' } });
    (readParticipant as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: '456', nickname: 'newuser' },
    });

    const result = await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'newuser',
        userFullName: 'New User',
        email: 'newuser@example.com',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    });

    expect(result.ok).toBe(true);
    expect((result as any).userId).toBe('456');
    expect((result as any).token).toEqual({ access_token: 'impersonate-token' });
    expect((result as any).user).toEqual({ id: '456', nickname: 'newuser' });
  });

  it('should use existing participant when user exists', async () => {
    const existingUser = { id: 123, nickname: 'existinguser' };
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [existingUser] } });
    (readParticipant as jest.Mock).mockResolvedValue({ ok: true, user: existingUser });

    const result = await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'existinguser',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    });

    expect(result.ok).toBe(true);
    expect((result as any).userId).toBe('123');
    expect(introspectToken).not.toHaveBeenCalled();
  });

  it('should create participant without fetching user info', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });
    (introspectToken as jest.Mock).mockResolvedValue({ resource: { id: '789' } });

    const result = await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'testuser',
        fetchUserInfo: false,
      },
    });

    expect(result.ok).toBe(true);
    expect((result as any).userId).toBe('789');
    expect((result as any).user).toBeNull();
    expect(readParticipant).not.toHaveBeenCalled();
  });

  it('should return error when user creation fails', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });
    (introspectToken as jest.Mock).mockResolvedValue(null);

    const result = await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'testuser',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to create user');
  });

  it('should require username', async () => {
    await expect(
      createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
        createOptions: {},
      })
    ).rejects.toThrow('Username is required');
  });
});
