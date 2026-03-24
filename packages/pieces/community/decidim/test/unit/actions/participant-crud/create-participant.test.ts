import { vi, type Mock } from 'vitest';
import { createParticipant } from '../../../../src/lib/domains/users/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import type { Response } from '../../../../src/lib/utils/response';
import type { DecidimAccessToken } from '../../../../src/types';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import {
  createImpersonateToken,
  buildOAuthGrantParam,
} from '../../../../src/lib/domains/users/impersonate';
import { introspectToken } from '../../../../src/lib/utils/introspecToken';
import { readParticipant } from '../../../../src/lib/domains/users/participant-crud';

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
  createImpersonateToken: vi.fn(),
  buildOAuthGrantParam: vi.fn(),
}));

vi.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: vi.fn(),
}));

vi.mock('../../../../src/lib/domains/users/participant-crud', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/lib/domains/users/participant-crud')>();
  return {
    ...actual,
    readParticipant: vi.fn(),
  };
});

type CreateParticipantSuccess = Response<{
  token: DecidimAccessToken;
  userId: string;
  user: { id: number | string; nickname?: string } | null;
}>;

describe('createParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;
  let mockOAuthApi: OAuthApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi = {
      users: vi.fn().mockResolvedValue({ data: { data: [] } }),
      userData: vi.fn().mockResolvedValue({ data: { data: {} } }),
      setUserData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    mockOAuthApi = {
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    } as unknown as OAuthApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => mockOAuthApi);
    (createImpersonateToken as Mock).mockResolvedValue({ access_token: 'impersonate-token' });
    (buildOAuthGrantParam as Mock).mockReturnValue({});
  });

  it('should create new participant when user does not exist', async () => {
    mockUsersApi.users = vi.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [{ id: '456', nickname: 'newuser' }] } });
    (introspectToken as Mock).mockResolvedValue({ resource: { id: '456' } });
    (readParticipant as Mock).mockResolvedValue({
      ok: true,
      user: { id: '456', nickname: 'newuser' },
    });

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
    expect(result.userId).toBe('456');
    expect(result.token).toEqual({ access_token: 'impersonate-token' });
    expect(result.user).toEqual({ id: '456', nickname: 'newuser' });
  });

  it('should use existing participant when user exists', async () => {
    const existingUser = { id: 123, nickname: 'existinguser' };
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [existingUser] } });
    (readParticipant as Mock).mockResolvedValue({ ok: true, user: existingUser });

    const result = (await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'existinguser',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    })) as CreateParticipantSuccess;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.userId).toBe('123');
    expect(introspectToken).not.toHaveBeenCalled();
  });

  it('should create participant without fetching user info', async () => {
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [] } });
    (introspectToken as Mock).mockResolvedValue({ resource: { id: '789' } });

    const result = (await createParticipant(config, 'clientId', 'clientSecret', mockOAuthApi, {
      createOptions: {
        username: 'testuser',
        fetchUserInfo: false,
      },
    })) as CreateParticipantSuccess;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.userId).toBe('789');
    expect(result.user).toBeNull();
    expect(readParticipant).not.toHaveBeenCalled();
  });

  it('should return error when user creation fails', async () => {
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [] } });
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
