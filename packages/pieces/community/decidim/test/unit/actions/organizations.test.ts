import { vi } from 'vitest';
import { organizations } from '../../../src/lib/domains/organizations/organizations';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { listOrganizations, getOrganization } = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
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
  createOrganizationsApi: vi.fn().mockReturnValue({
    listOrganizations,
    getOrganization,
  }),
}));

function run(props: Record<string, unknown>) {
  return organizations.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof organizations.run>[0]
  );
}

describe('organizations action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOrganizations.mockReset();
    getOrganization.mockReset();
  });

  it('search returns API list body as-is', async () => {
    listOrganizations.mockResolvedValueOnce({
      data: {
        data: [
          { id: '1', attributes: { host: 'a.example.org' } },
          { id: '2', attributes: { host: 'b.example.org' } },
          { id: '3', host: 'b.example.org' },
          'skip',
        ],
      },
    });

    const out = await run({
      action: 'search',
      searchOptions: { host: 'b.example.org' },
    });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual([
      { id: '1', attributes: { host: 'a.example.org' } },
      { id: '2', attributes: { host: 'b.example.org' } },
      { id: '3', host: 'b.example.org' },
      'skip',
    ]);
  });

  it('search requires host', async () => {
    const out = await run({ action: 'search' });
    expect(out.ok).toBe(false);
  });

  it('search returns empty body when data key is missing', async () => {
    listOrganizations.mockResolvedValueOnce({ data: {} });
    const out = await run({
      action: 'search',
      searchOptions: { host: 'x.org' },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out).toEqual({ ok: true, error: null });
  });

  it('read requires organization id', async () => {
    const out = await run({ action: 'read' });
    expect(out.ok).toBe(false);
  });

  it('search returns API body as-is for non-array data', async () => {
    listOrganizations.mockResolvedValueOnce({ data: { data: 'bad' } });
    const out = await run({
      action: 'search',
      searchOptions: { host: 'x.org' },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toBe('bad');
  });

  it('search returns an error when the API throws', async () => {
    listOrganizations.mockRejectedValueOnce(new Error('boom'));
    const out = await run({
      action: 'search',
      searchOptions: { host: 'x.org' },
    });
    expect(out.ok).toBe(false);
  });

  it('read loads one organization by id', async () => {
    getOrganization.mockResolvedValueOnce({
      data: { data: { id: '9', attributes: { host: 'x.org' } } },
    });
    const out = await run({
      action: 'read',
      readOptions: { organizationId: '9' },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: '9', attributes: { host: 'x.org' } });
    expect(getOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ id: '9', authorization: 'Bearer token' })
    );
  });

  it('returns error for unknown action', async () => {
    const out = await run({ action: 'update' });
    expect(out.ok).toBe(false);
  });

  it('exposes host only for search and id only for read', async () => {
    const search = await loadDynamicProps(organizations.props.searchOptions, {
      action: 'search',
    });
    expect(search).toHaveProperty('host');
    expect(await loadDynamicProps(organizations.props.searchOptions, { action: 'read' })).toEqual(
      {}
    );

    const read = await loadDynamicProps(organizations.props.readOptions, { action: 'read' });
    expect(read).toHaveProperty('organizationId');
    expect(await loadDynamicProps(organizations.props.readOptions, { action: 'search' })).toEqual(
      {}
    );
  });
});
