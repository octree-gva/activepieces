import { vi, type Mock } from 'vitest';
import { OAuthApi, UsersApi } from '@octree/decidim-sdk';
import { upsertParticipant } from '../../../src/lib/domains/users/upsert-participant';
import { roles } from '../../../src/lib/domains/roles/roles';
import { createMagicLink } from '../../../src/lib/domains/users/create-magic-link';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth, sampleDecidimAccessToken } from '../../helpers/decidim-test-fixtures';

const { createRoleMock, generateMagicLinkMock } = vi.hoisted(() => ({
  createRoleMock: vi.fn(),
  generateMagicLinkMock: vi.fn(),
}));

vi.mock('@octree/decidim-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@octree/decidim-sdk')>();
  return {
    ...actual,
    OAuthApi: vi.fn(),
    UsersApi: vi.fn(),
  };
});

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext: vi.fn().mockResolvedValue({
    mode: 'user',
    rawAccessToken: 'user-token',
    baseConfiguration: {},
  }),
  bearerAuthorization: vi.fn().mockReturnValue('Bearer user-token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createRolesApi: vi.fn().mockReturnValue({
    createRole: createRoleMock,
  }),
  createUsersApi: vi.fn().mockReturnValue({
    generateMagicLink: generateMagicLinkMock,
  }),
}));

describe('onboarding flow integration', () => {
  const mockOAuthApi = {
    createToken: vi.fn(),
  } as unknown as OAuthApi;

  const mockUsersApi = {
    users: vi.fn(),
    setUserData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    userData: vi.fn().mockResolvedValue({ data: { data: {} } }),
  } as unknown as UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    (OAuthApi as Mock).mockImplementation(() => mockOAuthApi);
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);

    mockOAuthApi.createToken = vi.fn().mockResolvedValue({ data: sampleDecidimAccessToken });
    mockUsersApi.users = vi.fn().mockResolvedValue({ data: { data: [{ id: 501 }] } });
    createRoleMock.mockResolvedValue({ data: { data: { id: 'r-1' } } });
    generateMagicLinkMock.mockResolvedValue({
      data: {
        data: {
          attributes: { token: 'magic-token' },
          links: { sign_in: { href: 'https://example.org/magic' } },
        },
      },
    });
  });

  it('upserts participant then assigns role then creates magic link', async () => {
    const upsert = await upsertParticipant.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue: {
          by: 'extended_data',
          options: {
            jsonPath: 'phone',
            value: '+12025550123',
            registerOnMissing: true,
            fetchUserInfo: false,
          },
        },
      }) as Parameters<typeof upsertParticipant.run>[0]
    );
    expect(upsert.ok).toBe(true);
    if (!upsert.ok) throw new Error('upsert failed');

    const assign = await roles.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue: {
          action: 'addPrivateAssemblyMember',
          createOptions: { assemblyId: 9001, userId: Number(upsert.userId) },
        },
      }) as Parameters<typeof roles.run>[0]
    );
    expect(assign.ok).toBe(true);

    const magic = await createMagicLink.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue: {
          accessToken: 'user-token',
          redirectUrl: 'https://example.org/assemblies/9001',
        },
      }) as Parameters<typeof createMagicLink.run>[0]
    );
    expect(magic.ok).toBe(true);
  });
});
