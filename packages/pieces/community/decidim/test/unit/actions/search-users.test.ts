import { vi } from 'vitest';
import { searchUsers } from '../../../src/lib/domains/users/search-users';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { listUsers } = vi.hoisted(() => ({
  listUsers: vi.fn(),
}));

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext: vi.fn().mockResolvedValue({
    mode: 'system',
    rawAccessToken: 'token',
    baseConfiguration: {},
  }),
  bearerAuthorization: vi.fn().mockReturnValue('Bearer token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createUsersApi: vi.fn().mockReturnValue({
    listUsers,
  }),
}));

function run(props: Record<string, unknown> = {}) {
  return searchUsers.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof searchUsers.run>[0]
  );
}

describe('searchUsers action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsers.mockReset();
  });

  it('lists users with default pagination', async () => {
    listUsers.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } });
    const out = await run();
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.users).toEqual([{ id: 1 }]);
    expect(searchUsers.displayName).toBe('Search Users');
    expect(listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 50 })
    );
  });

  it('forwards page and perPage', async () => {
    listUsers.mockResolvedValueOnce({ data: { data: [] } });
    await run({ page: 2, perPage: 10 });
    expect(listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 10 })
    );
  });

  it('treats missing data as empty', async () => {
    listUsers.mockResolvedValueOnce({ data: {} });
    const out = await run();
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.users).toEqual([]);
  });

  it('treats non-array payload as empty', async () => {
    listUsers.mockResolvedValueOnce({ data: { data: 'bad' } });
    const out = await run();
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.users).toEqual([]);
  });

  it('returns error when the API throws', async () => {
    listUsers.mockRejectedValueOnce(new Error('boom'));
    const out = await run();
    expect(out.ok).toBe(false);
  });
});
