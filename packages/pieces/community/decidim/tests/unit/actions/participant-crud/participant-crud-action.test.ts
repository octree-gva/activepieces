import { participantCrud } from '../../../../src/lib/domains/users/participant-crud';
import { UsersApi, OAuthApi } from '@octree/decidim-sdk';
import { createMockActionContext } from '../../../helpers/create-mock-action-context';
import { AppConnectionType } from '@activepieces/pieces-framework';

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

jest.mock('../../../../src/lib/domains/users/impersonate', () => ({
  createImpersonateToken: jest.fn().mockResolvedValue({ access_token: 'token' }),
  buildOAuthGrantParam: jest.fn(),
}));

jest.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: jest.fn().mockResolvedValue({ resource: { id: '123' } }),
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
    jest.clearAllMocks();
    mockUsersApi = {
      users: jest.fn().mockResolvedValue({ data: { data: [] } }),
      userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
      setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);
    (OAuthApi as jest.Mock).mockImplementation(() => ({
      createToken: jest.fn().mockResolvedValue({ data: { access_token: 'token' } }),
    }));
  });

  it('should execute search action', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [{ id: 1 }] } });

    const result = (await participantCrud.run(
      participantContext({
        action: 'search',
        searchOptions: { extendedDataQuery: '{"key": "value"}' },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.users).toBeDefined();
  });

  it('should execute create action', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });

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
      userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
      users: jest.fn().mockResolvedValue({ data: { data: [{ id: 123 }] } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);

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
      setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);

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
        searchOptions: { extendedDataQuery: '{"key": "value"}' },
      })
    )) as ParticipantCrudRunResult;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('Unknown action');
  });
});
