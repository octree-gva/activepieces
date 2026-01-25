import { participantCrud } from '../../../../src/lib/actions/participant-crud';
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

jest.mock('../../../../src/lib/actions/impersonate', () => ({
  createImpersonateToken: jest.fn().mockResolvedValue({ access_token: 'token' }),
  buildOAuthGrantParam: jest.fn(),
}));

jest.mock('../../../../src/lib/utils/introspecToken', () => ({
  introspectToken: jest.fn().mockResolvedValue({ resource: { id: '123' } }),
}));

describe('participantCrud action', () => {
  const createMockContext = (propsValue: any) => ({
    propsValue,
    auth: {
      baseUrl: 'http://test.com',
      clientId: 'clientId',
      clientSecret: 'clientSecret',
    },
  });

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

    const result = await participantCrud.run(createMockContext({
      action: 'search',
      searchOptions: { extendedDataQuery: '{"key": "value"}' },
    }) as any);

    expect((result as any).ok).toBe(true);
    expect((result as any).users).toBeDefined();
  });

  it('should execute create action', async () => {
    mockUsersApi.users = jest.fn().mockResolvedValue({ data: { data: [] } });

    const result = await participantCrud.run(createMockContext({
      action: 'create',
      createOptions: {
        username: 'testuser',
        userFullName: 'Test User',
        email: 'test@example.com',
      },
    }) as any);

    expect((result as any).ok).toBe(true);
  });

  it('should execute read action', async () => {
    mockUsersApi = {
      userData: jest.fn().mockResolvedValue({ data: { data: {} } }),
      users: jest.fn().mockResolvedValue({ data: { data: [{ id: 123 }] } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);

    const result = await participantCrud.run(createMockContext({
      action: 'read',
      readOptions: { userId: '123' },
    }) as any);

    expect((result as any).ok).toBe(true);
  });

  it('should execute update action', async () => {
    mockUsersApi = {
      setUserData: jest.fn().mockResolvedValue({ data: { data: {} } }),
    } as unknown as UsersApi;
    (UsersApi as jest.Mock).mockImplementation(() => mockUsersApi);

    const result = await participantCrud.run(createMockContext({
      action: 'update',
      updateOptions: {
        userId: '123',
        extendedData: { key: 'value' },
      },
    }) as any);

    expect((result as any).ok).toBe(true);
  });

  it('should return error for unknown action', async () => {
    const result = await participantCrud.run(createMockContext({
      action: 'unknown',
      searchOptions: { extendedDataQuery: '{"key": "value"}' },
    }) as any);

    expect((result as any).ok).toBe(false);
    expect((result as any).error).toContain('Unknown action');
  });
});
