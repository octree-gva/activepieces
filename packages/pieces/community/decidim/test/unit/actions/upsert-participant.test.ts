import { vi, type Mock } from 'vitest';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { upsertParticipant } from '../../../src/lib/domains/users/upsert-participant';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth, sampleDecidimAccessToken } from '../../helpers/decidim-test-fixtures';
import type { Response } from '../../../src/lib/utils/response';

vi.mock('@octree/decidim-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@octree/decidim-sdk')>();
  return {
    ...actual,
    OAuthApi: vi.fn(),
    UsersApi: vi.fn(),
  };
});

type UpsertResult = Response<{
  existed: boolean;
  created: boolean;
  matchedBy: string;
  matchedValue: string;
  userId?: string;
  accessToken?: string;
}>;

describe('upsertParticipant', () => {
  const mockOAuthApi = {
    createToken: vi.fn(),
  } as unknown as OAuthApi;

  const mockUsersApi = {
    listUsers: vi.fn(),
    setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
  } as unknown as UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    (OAuthApi as Mock).mockImplementation(() => mockOAuthApi);
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    mockOAuthApi.createToken = vi.fn().mockResolvedValue({ data: sampleDecidimAccessToken });
  });

  function runWith(propsValue: Record<string, unknown>) {
    return upsertParticipant.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue,
      }) as Parameters<typeof upsertParticipant.run>[0]
    ) as Promise<UpsertResult>;
  }

  it('returns existing participant by nickname', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({
      data: { data: [{ id: 10, nickname: 'john' }] },
    });

    const result = await runWith({
      by: 'nickname',
      options: { nickname: 'john' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.existed).toBe(true);
    expect(result.created).toBe(false);
    expect(result.userId).toBe('10');
  });

  it('creates participant by email when missing', async () => {
    mockUsersApi.listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [{ id: 21, nickname: 'jane' }] } });

    const result = await runWith({
      by: 'email',
      options: {
        email: 'jane@example.com',
        registerOnMissing: true,
        fetchUserInfo: false,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.created).toBe(true);
    expect(result.existed).toBe(false);
    expect(result.matchedBy).toBe('email');
    expect(result.accessToken).toBe(sampleDecidimAccessToken.access_token);
  });

  it('searches by extended_data json path', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({
      data: { data: [{ id: 77 }] },
    });

    const result = await runWith({
      by: 'extended_data',
      options: {
        jsonPath: 'phone',
        value: '+12025550123',
      },
    });

    expect(result.ok).toBe(true);
    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        filterExtendedDataCont: '{"phone": "+12025550123"}',
      })
    );
  });
});
