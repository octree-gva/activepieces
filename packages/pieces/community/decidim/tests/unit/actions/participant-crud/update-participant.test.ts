import { updateParticipant } from '../../../../src/lib/actions/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
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

describe('updateParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersApi = {
      setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should update participant extended data', async () => {
    const updatedData = { chatbotID: '31' };
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: { data: updatedData } });

    const result = await updateParticipant(config, 'clientId', 'clientSecret', {
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.userId).toBe('123');
    expect(result.data).toEqual(updatedData);
  });

  it('should update data at custom path', async () => {
    const updatedData = { nested: { field: 'value' } };
    mockUsersApi.setUserData = jest.fn().mockResolvedValue({ data: { data: updatedData } });

    await updateParticipant(config, 'clientId', 'clientSecret', {
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
        dataPath: '.nested',
      },
    });

    expect(mockUsersApi.setUserData).toHaveBeenCalledWith({
      userExtendedDataPayload: {
        object_path: '.nested',
        data: updatedData,
      },
    });
  });

  it('should parse JSON string extendedData', async () => {
    await updateParticipant(config, 'clientId', 'clientSecret', {
      updateOptions: {
        userId: '123',
        extendedData: '{"chatbotID": "31"}',
      },
    });

    expect(mockUsersApi.setUserData).toHaveBeenCalledWith({
      userExtendedDataPayload: {
        object_path: '.',
        data: { chatbotID: '31' },
      },
    });
  });

  it('should require userId and extendedData', async () => {
    await expect(
      updateParticipant(config, 'clientId', 'clientSecret', {
        updateOptions: { userId: '123' },
      })
    ).rejects.toThrow('Extended Data is required');

    await expect(
      updateParticipant(config, 'clientId', 'clientSecret', {
        updateOptions: { extendedData: { key: 'value' } },
      })
    ).rejects.toThrow('User ID is required');
  });

  it('should reject empty extendedData', async () => {
    await expect(
      updateParticipant(config, 'clientId', 'clientSecret', {
        updateOptions: { userId: '123', extendedData: {} },
      })
    ).rejects.toThrow('Extended Data is required');
  });
});
