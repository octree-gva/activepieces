import { vi, type Mock } from 'vitest';
import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { UsersApi, OAuthApi } from '@octree/decidim-sdk';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import { AppConnectionType } from '@activepieces/pieces-framework';

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

vi.mock('../../../../src/lib/domains/users/impersonate', () => ({
  createImpersonateToken: vi.fn().mockResolvedValue({ access_token: 'token' }),
  buildOAuthGrantParam: vi.fn(),
}));

vi.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: vi.fn().mockResolvedValue({ resource: { id: '123' } }),
}));

type ParticipantCrudContext = Parameters<typeof participantCrud.run>[0];

/** `participantCrud.run` is typed loosely by the framework; tests assert on this shape. */
type ParticipantCrudRunResult = {
  ok: boolean;
  error: string | null;
  users?: unknown[];
  userId?: string;
  token?: unknown;
  user?: unknown | null;
};

const mockAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'Test OAuth app',
    tenants: JSON.stringify({
      'http://test.com': {
        client_id: 'clientId',
        client_secret: 'clientSecret',
        scopes: 'oauth',
      },
    }),
  },
} as const;

function participantContext(propsValue: Record<string, unknown>): ParticipantCrudContext {
  return createMockActionContext({
    auth: mockAuth,
    propsValue: {
      host: 'http://test.com',
      ...propsValue,
    },
  }) as unknown as ParticipantCrudContext;
}

describe('participantCrud action', () => {
  let mockUsersApi: UsersApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi = {
      listUsers: vi.fn().mockResolvedValue({ data: { data: [] } }),
      getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
      setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as Mock).mockImplementation(() => ({
      createToken: vi.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should execute search action', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [{ id: 1 }] } });

    const result = (await participantCrud.run(
      participantContext({
        action: 'search',
        searchOptions: {
          nicknames: [{ value: 'alice' }],
        },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.users).toBeDefined();
  });

  it('should execute create action', async () => {
    mockUsersApi.listUsers = vi.fn().mockResolvedValue({ data: { data: [] } });

    const result = (await participantCrud.run(
      participantContext({
        action: 'create',
        createOptions: {
          username: 'testuser',
          userFullName: 'Test User',
          email: 'test@example.com',
        },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(true);
  });

  it('should execute read action', async () => {
    mockUsersApi = {
      getUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
      listUsers: vi.fn().mockResolvedValue({ data: { data: [{ id: 123 }] } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);

    const result = (await participantCrud.run(
      participantContext({
        action: 'read',
        readOptions: { userId: '123' },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(true);
  });

  it('should execute update action', async () => {
    mockUsersApi = {
      setUserExtendedData: vi.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as Mock).mockImplementation(() => mockUsersApi);

    const result = (await participantCrud.run(
      participantContext({
        action: 'update',
        updateOptions: {
          userId: '123',
          extendedData: { key: 'value' },
        },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(true);
  });

  it('should return error for unknown action', async () => {
    const result = (await participantCrud.run(
      participantContext({
        action: 'unknown',
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('Unknown action');
  });
});
