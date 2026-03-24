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

jest.mock('@octree/decidim-sdk', () => {
  const actual = jest.requireActual('@octree/decidim-sdk');
  return {
    ...actual,
    OAuthApi: jest.fn(),
    UsersApi: jest.fn(),
  };
});

jest.mock('../../../../src/lib/utils/systemAccessToken');
jest.mock('../../../../src/lib/utils/introspecToken');

type CreateResult = Response<{
  token: DecidimAccessToken;
  userId: string;
  user: ParticipantUserStub | null;
}>;

const mockOAuthApi = {
  createToken: jest.fn(),
} as unknown as OAuthApi;

const mockUsersApi = {
  users: jest.fn(),
  userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
  setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
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
    jest.clearAllMocks();
    (OAuthApi as jest.Mock).mockImplementation(() => mockOAuthApi);
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
  });

  it('should create new participant when user does not exist', async () => {
    const mockUser = { id: '456', nickname: 'newuser', email: 'newuser@example.com' };
    mockUsersApi.users = jest.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [mockUser] } });
    mockUsersApi.userData = jest.fn().mockResolvedValue({ data: { data: {} } });
    (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    jest.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    jest.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue({
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
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [existingUser] } });
    mockUsersApi.userData = jest.fn().mockResolvedValue({ data: { data: {} } });
    (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: sampleDecidimAccessToken });

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
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });
    (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    jest.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    jest.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue({
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
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });
    (mockOAuthApi.createToken as jest.Mock).mockResolvedValue({ data: sampleDecidimAccessToken });
    jest.spyOn(systemAccessTokenModule, 'systemAccessToken').mockResolvedValue('system-token');
    jest.spyOn(introspectTokenModule, 'introspectToken').mockResolvedValue(null);

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
    mockUsersApi.users = jest.fn().mockRejectedValue(axiosError);

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
