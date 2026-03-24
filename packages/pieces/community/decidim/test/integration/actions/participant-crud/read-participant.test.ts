import { vi, type Mock } from 'vitest';
import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import axios from 'axios';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../../helpers/decidim-test-fixtures';

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

type ReadResult = Response<{ userId: string; data: unknown; user: unknown }>;

const mockUsersApi = {
  userData: vi.fn(),
  users: vi.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'read';
  readOptions: { userId: string };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: decidimCustomAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Read Participant Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(axios, 'isAxiosError').mockRestore();
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should return participant data and user info', async () => {
    const mockUserData = { chatbotID: '31', customField: 'value' };
    const mockUser = { id: 123, nickname: 'testuser', email: 'test@example.com' };
    mockUsersApi.userData = vi.fn().mockResolvedValue({ data: { data: mockUserData } });
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [mockUser] } });

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
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    mockUsersApi.userData = vi.fn().mockRejectedValue(axiosError);
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [mockUser] } });

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
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    mockUsersApi.userData = vi.fn().mockRejectedValue(axiosError);

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
    mockUsersApi.users = vi.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'read',
      readOptions: { userId: '123' },
    })) as ReadResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
