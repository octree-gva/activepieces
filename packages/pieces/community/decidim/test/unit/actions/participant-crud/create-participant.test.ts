import { vi, type Mock } from 'vitest';
import { createParticipant } from '../../../../src/lib/domains/users/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import type { Response } from '../../../../src/lib/utils/response';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { buildOAuthGrantParam } from '../../../../src/lib/domains/users/impersonate';
import { introspectToken } from '../../../../src/lib/utils/introspecToken';

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

vi.mock('../../../../src/lib/domains/users/impersonate', () => ({
  buildOAuthGrantParam: vi.fn(),
}));

vi.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: vi.fn(),
}));

type CreateParticipantSuccess = Response<{
  token: Record<string, unknown>;
  introspect?: Record<string, unknown>;
  extended_data?: unknown;
  users?: Record<string, unknown>;
}>;

describe('createParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;
  let mockOAuthApi: OAuthApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi = {
      listUsers: vi.fn().mockResolvedValue({ data: { data: [] } }),
      getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
      setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: { set: true } } }),
    } as unknown as UsersApi;
    mockOAuthApi = {
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'impersonate-token' } }),
    } as unknown as OAuthApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => mockOAuthApi);
    (buildOAuthGrantParam as Mock).mockReturnValue({});
  });

  it('should create new participant when user does not exist', async () => {
    const createdUser = { id: '456', nickname: 'newuser' };
    mockUsersApi.listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [createdUser] } });
    mockUsersApi.getUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: { chatbotID: '31' } } });
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: { set: true } } });
    (introspectToken as Mock).mockResolvedValue({ resource: { id: '456' } });

    const result = (await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'newuser',
        userFullName: 'New User',
        email: 'newuser@example.com',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    })) as CreateParticipantSuccess;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.token).toEqual({ access_token: 'impersonate-token' });
    expect(result.introspect).toEqual({ resource: { id: '456' } });
    expect(result.users).toEqual({ data: [createdUser] });
    expect(result.extended_data).toEqual({ data: { chatbotID: '31' } });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('user');
  });

  it('should use existing participant when user exists', async () => {
    const existingUser = { id: 123, nickname: 'existinguser' };
    mockUsersApi.listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: [existingUser] } })
      .mockResolvedValueOnce({ data: { data: [existingUser] } });
    mockUsersApi.getUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: {} } });

    const result = (await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'existinguser',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    })) as CreateParticipantSuccess;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.token).toEqual({ access_token: 'impersonate-token' });
    expect(result).not.toHaveProperty('introspect');
    expect(result.users).toEqual({ data: [existingUser] });
    expect(introspectToken).not.toHaveBeenCalled();
  });

  it('should create participant without fetching user info', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });
    (introspectToken as Mock).mockResolvedValue({ resource: { id: '789' } });

    const result = (await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'testuser',
        fetchUserInfo: false,
      },
    })) as CreateParticipantSuccess;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.token).toEqual({ access_token: 'impersonate-token' });
    expect(result.introspect).toEqual({ resource: { id: '789' } });
    expect(result).not.toHaveProperty('users');
    expect(result).not.toHaveProperty('userId');
    expect(mockUsersApi.getUserExtendedData).not.toHaveBeenCalled();
  });

  it('should return error when user creation fails', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });
    (introspectToken as Mock).mockResolvedValue(null);

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
