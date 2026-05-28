import { vi, type Mock } from 'vitest';
import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import { DecidimAccessToken } from '../../../../src/types';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import {
  decidimCustomAuth,
  sampleDecidimAccessToken,
} from '../../../helpers/decidim-test-fixtures';
import * as systemAccessTokenModule from '../../../../src/lib/utils/systemAccessToken';
import * as introspectTokenModule from '../../../../src/lib/utils/introspecToken';
import type { introspectToken } from '../../../../src/lib/utils/introspecToken';

type IntrospectResult = NonNullable<Awaited<ReturnType<typeof introspectToken>>>;

type ParticipantUserStub = {
  id: number | string;
  nickname?: string;
  email?: string;
};

vi.mock('@octree/decidim-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@octree/decidim-sdk')>();
  return {
    ...actual,
    OAuthApi: vi.fn(),
    UsersApi: vi.fn(),
  };
});

vi.mock('../../../../src/lib/utils/systemAccessToken', () => ({
  systemAccessToken: vi.fn(),
}));

vi.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: vi.fn(),
}));

type CreateResult = Response<{
  token: DecidimAccessToken;
  userId: string;
  user: ParticipantUserStub | null;
}>;

const mockOAuthApi = {
  createToken: vi.fn(),
} as unknown as OAuthApi;

const mockUsersApi = {
  listUsers: vi.fn(),
  getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
  setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'create';
  createOptions: {
    username: string;
    userFullName?: string;
    email?: string;
    extendedData?: Record<string, unknown>;
    fetchUserInfo?: boolean;
  };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: decidimCustomAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Create Participant Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (OAuthApi as Mock).mockImplementation(() => mockOAuthApi);
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
  });

  it('should create new participant when user does not exist', async () => {
    const mockUser = { id: '456', nickname: 'newuser', email: 'newuser@example.com' };
    mockUsersApi.listUsers = vi.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [mockUser] } });
    mockUsersApi.getUserExtendedData = vi.fn().mockResolvedValue({ data: { data: {} } });
    (mockOAuthApi.createToken as Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    vi.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    vi.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue({
      active: true,
      resource: { id: '456' },
    } as unknown as IntrospectResult);

    const result = await participantCrud.run(createContext({
      action: 'create',
      createOptions: {
        username: 'newuser',
        userFullName: 'New User',
        email: 'newuser@example.com',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: true,
      },
    })) as CreateResult;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.userId).toBe('456');
    expect(result.token).toBeDefined();
    expect(result.user).toEqual(mockUser);
  });

  it('should use existing participant when user exists', async () => {
    const existingUser = { id: 123, nickname: 'existinguser' };
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [existingUser] } });
    mockUsersApi.getUserExtendedData = vi.fn().mockResolvedValue({ data: { data: {} } });
    (mockOAuthApi.createToken as Mock).mockResolvedValue({ data: sampleDecidimAccessToken });

    const result = await participantCrud.run(createContext({
      action: 'create',
      createOptions: {
        username: 'existinguser',
        extendedData: { chatbotID: '31' },
        fetchUserInfo: false,
      },
    })) as CreateResult;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.userId).toBe('123');
  });

  it('should create participant without fetching user info', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });
    (mockOAuthApi.createToken as Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    vi.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    vi.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue({
      active: true,
      resource: { id: '789' },
    } as unknown as IntrospectResult);

    const result = await participantCrud.run(createContext({
      action: 'create',
      createOptions: {
        username: 'testuser',
        fetchUserInfo: false,
      },
    })) as CreateResult;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.userId).toBe('789');
    expect(result.user).toBeNull();
  });

  it('should return error when user creation fails', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });
    (mockOAuthApi.createToken as Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    vi.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    vi.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue(null);

    const result = await participantCrud.run(createContext({
      action: 'create',
      createOptions: {
        username: 'testuser',
      },
    })) as CreateResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to create user');
  });

  it('should handle API errors', async () => {
    const axiosError = {
      response: { status: 400, data: { error: 'Invalid request' } },
      message: 'Bad request',
      isAxiosError: true,
    };
    mockUsersApi.listUsers = vi.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'create',
      createOptions: {
        username: 'testuser',
      },
    })) as CreateResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
