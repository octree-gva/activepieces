import { participantCrud } from '../../../../src/lib/actions/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import axios from 'axios';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import { AppConnectionType } from '@activepieces/shared';

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

type ReadResult = Response<{ userId: string; data: any; user: any }>;

const mockAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    baseUrl: 'https://example.decidim.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
} as const;

const mockUsersApi = {
  userData: jest.fn(),
  users: jest.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'read';
  readOptions: { userId: string };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: mockAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Read Participant Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(axios, 'isAxiosError').mockRestore();
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should return participant data and user info', async () => {
    const mockUserData = { chatbotID: '31', customField: 'value' };
    const mockUser = { id: 123, nickname: 'testuser', email: 'test@example.com' };
    mockUsersApi.userData = jest.fn().mockResolvedValue({ data: { data: mockUserData } });
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [mockUser] } });

    const result = await participantCrud.run(createContext({
      action: 'read',
      readOptions: { userId: '123' },
    })) as ReadResult;

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
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    mockUsersApi.userData = jest.fn().mockRejectedValue(axiosError);
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [mockUser] } });

    const result = await participantCrud.run(createContext({
      action: 'read',
      readOptions: { userId: '123' },
    })) as ReadResult;

    expect(result.ok).toBe(true);
    expect(result.userId).toBe('123');
    expect(result.data).toBeNull();
    expect(result.user).toEqual(mockUser);
  });

  it('should throw non-404 errors', async () => {
    const axiosError = {
      response: { status: 500, data: { error: 'Server error' } },
      isAxiosError: true,
    };
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    mockUsersApi.userData = jest.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'read',
      readOptions: { userId: '123' },
    })) as ReadResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle API errors', async () => {
    const axiosError = {
      response: { status: 500, data: { error: 'Internal server error' } },
      message: 'Server error',
      isAxiosError: true,
    };
    mockUsersApi.users = jest.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'read',
      readOptions: { userId: '123' },
    })) as ReadResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
