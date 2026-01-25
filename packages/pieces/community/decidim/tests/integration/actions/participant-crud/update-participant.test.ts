import { participantCrud } from '../../../../src/lib/actions/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';

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

type UpdateResult = Response<{ userId: string; data: any }>;

const mockAuth = {
  baseUrl: 'https://example.decidim.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};

const mockUsersApi = {
  setUserData: jest.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'update';
  updateOptions: {
    userId: string;
    extendedData: Record<string, any> | string;
    dataPath?: string;
  };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: mockAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Update Participant Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should update participant extended data', async () => {
    const updatedData = { chatbotID: '31', customField: 'updated' };
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: { data: updatedData } });

    const result = await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
      },
    })) as UpdateResult;

    expect(result.ok).toBe(true);
    expect(result.userId).toBe('123');
    expect(result.data).toEqual(updatedData);
  });

  it('should update data at custom path', async () => {
    const updatedData = { nested: { field: 'value' } };
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: { data: updatedData } });

    await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
        dataPath: '.nested',
      },
    }));

    expect(mockUsersApi.setUserData).toHaveBeenCalledWith({
      userExtendedDataPayload: {
        object_path: '.nested',
        data: updatedData,
      },
    });
  });

  it('should parse JSON string extendedData', async () => {
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: { data: { chatbotID: '31' } } });

    await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: '{"chatbotID": "31"}',
      },
    }));

    expect(mockUsersApi.setUserData).toHaveBeenCalledWith({
      userExtendedDataPayload: {
        object_path: '.',
        data: { chatbotID: '31' },
      },
    });
  });

  it('should handle API errors', async () => {
    const axiosError = {
      response: { status: 400, data: { error: 'Invalid request' } },
      message: 'Bad request',
      isAxiosError: true,
    };
    mockUsersApi.setUserData = jest.fn().mockRejectedValue(axiosError);

    const result = await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: { key: 'value' },
      },
    })) as UpdateResult;

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should use extendedData when API response data is missing', async () => {
    const extendedData = { chatbotID: '31' };
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: null });

    const result = await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData,
      },
    })) as UpdateResult;

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(extendedData);
  });
});
