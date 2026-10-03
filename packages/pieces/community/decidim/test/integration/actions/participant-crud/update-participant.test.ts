import { vi, type Mock } from 'vitest';
import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { Response } from '../../../../src/lib/utils/response';
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

type UpdateResult = Response<{ data?: unknown }>;

const mockUsersApi = {
  setUserExtendedData: vi.fn(),
} as unknown as UsersApi;

const createContext = (propsValue: {
  action: 'update';
  updateOptions: {
    userId: string;
    extendedData: Record<string, unknown> | string;
    dataPath?: string;
  };
}): Parameters<typeof participantCrud.run>[0] => createMockActionContext({
  auth: decidimCustomAuth,
  propsValue,
  step: { name: 'participant' },
}) as Parameters<typeof participantCrud.run>[0];

describe('Update Participant Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should update participant extended data', async () => {
    const updatedData = { chatbotID: '31', customField: 'updated' };
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: updatedData } });

    const result = await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
      },
    })) as UpdateResult;

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(updatedData);
    expect(result).not.toHaveProperty('userId');
  });

  it('should update data at custom path', async () => {
    const updatedData = { nested: { field: 'value' } };
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: updatedData } });

    await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
        dataPath: '.nested',
      },
    }));

    expect(mockUsersApi.setUserExtendedData).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer token',
        userExtendedDataPayload: {
          object_path: '.nested',
          data: updatedData,
        },
      })
    );
  });

  it('should parse JSON string extendedData', async () => {
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: { chatbotID: '31' } } });

    await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: '{"chatbotID": "31"}',
      },
    }));

    expect(mockUsersApi.setUserExtendedData).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer token',
        userExtendedDataPayload: {
          object_path: '.',
          data: { chatbotID: '31' },
        },
      })
    );
  });

  it('should rethrow API axios errors', async () => {
    const axiosError = {
      response: { status: 400, data: { error: 'Invalid request' } },
      message: 'Bad request',
      isAxiosError: true,
    };
    mockUsersApi.setUserExtendedData = vi.fn().mockRejectedValue(axiosError);

    try {
      await participantCrud.run(
        createContext({
          action: 'update',
          updateOptions: {
            userId: '123',
            extendedData: { key: 'value' },
          },
        })
      );
      expect.fail('expected throw');
    } catch (thrown) {
      expect(thrown).toMatchObject({
        __apErrorVersion: 1,
        status: 400,
        error: 'Invalid request',
        error_description: 'Invalid request',
        error_details: [],
      });
      const roundTrip = JSON.parse(JSON.stringify(thrown));
      expect(roundTrip.error_details).toEqual([]);
      expect(roundTrip.error).toBe('Invalid request');
    }
  });

  it('should use empty body when API response data is missing', async () => {
    const extendedData = { chatbotID: '31' };
    mockUsersApi.setUserExtendedData = vi.fn().mockResolvedValue({ data: null });

    const result = await participantCrud.run(createContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData,
      },
    })) as UpdateResult;

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('userId');
  });
});
