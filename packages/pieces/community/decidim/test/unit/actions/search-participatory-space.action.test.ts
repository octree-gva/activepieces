import { vi } from 'vitest';
import { searchParticipatorySpace } from '../../../src/lib/domains/spaces/search-participatory-space';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { searchSpaces } = vi.hoisted(() => ({
  searchSpaces: vi.fn(),
}));

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext: vi.fn().mockResolvedValue({
    mode: 'user',
    rawAccessToken: 'token',
    baseConfiguration: {},
  }),
  bearerAuthorization: vi.fn().mockReturnValue('Bearer token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createSpacesApi: vi.fn().mockReturnValue({
    searchSpaces,
  }),
}));

function run(props: Record<string, unknown> = {}) {
  return searchParticipatorySpace.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof searchParticipatorySpace.run>[0]
  );
}

describe('searchParticipatorySpace action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchSpaces.mockReset();
  });

  it('returns one page of spaces', async () => {
    searchSpaces.mockResolvedValueOnce({
      data: { data: [{ id: 1 }, { id: 2 }] },
    });

    const out = await run({ perPage: 10, page: 1 });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.spaces).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out.count).toBe(2);
    expect(searchSpaces).toHaveBeenCalledTimes(1);
  });

  it('forwards filters and pagination to searchSpaces', async () => {
    searchSpaces.mockResolvedValueOnce({ data: { data: [] } });

    await run({
      spaceIds: [{ value: 12 }],
      spaceManifests: [{ value: 'assemblies' }],
      page: 2,
      perPage: 25,
    });

    expect(searchSpaces).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: 'Bearer token',
        page: 2,
        perPage: 25,
        filterIdIn: [12],
        filterManifestNameIn: ['assemblies'],
      })
    );
  });

  it('returns empty spaces when API returns non-array data', async () => {
    searchSpaces.mockResolvedValueOnce({ data: { data: 'bad' } });

    const out = await run({ perPage: 10 });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.spaces).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('searches when no filters are set', async () => {
    searchSpaces.mockResolvedValueOnce({ data: { data: [] } });

    const out = await run({});

    expect(out.ok).toBe(true);
    expect(searchSpaces).toHaveBeenCalledTimes(1);
  });
});
