import { vi, type Mock } from 'vitest';
import { updateParticipant } from '../../../../src/lib/domains/users/participant-crud';
import { configuration } from '../../../../src/lib/utils/configuration';
import { UsersApi, OAuthApi } from '@octree/decidim-sdk';

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

describe('updateParticipant', () => {
  const config = configuration({ baseUrl: 'http://test.com' });
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi = {
      setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should update participant extended data', async () => {
    const updatedData = { chatbotID: '31' };
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: updatedData } });

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
    mockUsersApi.setUserExtendedData = vi
      .fn()
      .mockResolvedValue({ data: { data: updatedData } });

    await updateParticipant(config, 'clientId', 'clientSecret', {
      updateOptions: {
        userId: '123',
        extendedData: updatedData,
        dataPath: '.nested',
      },
    });

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
    await updateParticipant(config, 'clientId', 'clientSecret', {
      updateOptions: {
        userId: '123',
        extendedData: '{"chatbotID": "31"}',
      },
    });

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
