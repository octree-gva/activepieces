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
  users?: Record<string, unknown>;
  token?: Record<string, unknown>;
  introspect?: Record<string, unknown>;
  extended_data?: Record<string, unknown>;
}>;

describe('upsertParticipant', () => {
  const mockOAuthApi = {
    createToken: vi.fn(),
    introspectToken: vi.fn(),
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
    mockOAuthApi.introspectToken = vi.fn().mockResolvedValue({
      data: { active: true, resource: { id: 21 } },
    });
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
    const usersBody = { data: [{ id: 10, nickname: 'john' }] };
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: usersBody });

    const result = await runWith({
      by: 'nickname',
      options: { nickname: 'john' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.users).toEqual(usersBody);
    expect(result).not.toHaveProperty('existed');
    expect(result).not.toHaveProperty('created');
    expect(result).not.toHaveProperty('userId');
  });

  it('creates participant by email when missing', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });

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
    expect(result.token).toEqual(sampleDecidimAccessToken);
    expect(result.introspect).toEqual({ active: true, resource: { id: 21 } });
    expect(result).not.toHaveProperty('existed');
    expect(result).not.toHaveProperty('created');
    expect(result).not.toHaveProperty('matchedBy');
    expect(result).not.toHaveProperty('accessToken');
  });

  it('updates locale when the participant already exists', async () => {
    const usersBody = { data: [{ id: 10, nickname: 'john' }] };
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: usersBody });

    const result = await runWith({
      by: 'nickname',
      options: { nickname: 'john', locale: 'fr' },
    });

    expect(result.ok).toBe(true);
    expect(mockOAuthApi.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthGrantParam: expect.objectContaining({
          id: '10',
          meta: expect.objectContaining({ locale: 'fr' }),
        }),
      })
    );
    expect(mockUsersApi.listUsers).toHaveBeenCalledTimes(2);
  });

  it('sends locale when creating a missing participant', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });

    const result = await runWith({
      by: 'email',
      options: {
        email: 'jane@example.com',
        registerOnMissing: true,
        fetchUserInfo: false,
        locale: 'fr',
      },
    });

    expect(result.ok).toBe(true);
    expect(mockOAuthApi.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthGrantParam: expect.objectContaining({
          username: expect.any(String),
          meta: expect.objectContaining({
            locale: 'fr',
            register_on_missing: true,
          }),
        }),
      })
    );
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
    expect(result.users).toEqual({ data: [{ id: 77 }] });
    expect(mockUsersApi.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        filterExtendedDataCont: '{"phone": "+12025550123"}',
      })
    );
  });
});
