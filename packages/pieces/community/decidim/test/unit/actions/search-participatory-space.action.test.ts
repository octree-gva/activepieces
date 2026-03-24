import { vi, type MockedFunction } from 'vitest';
import { searchParticipatorySpace } from '../../../src/lib/domains/spaces/search-participatory-space';
import { createSpacesApi } from '../../../src/lib/runtime/clients';
import { extractAuth } from '../../../src/lib/utils/auth';
import { resolveAuthContext } from '../../../src/lib/runtime/authMode';

vi.mock('../../../src/lib/utils/auth');
vi.mock('../../../src/lib/runtime/authMode');
vi.mock('../../../src/lib/runtime/clients');

const extractAuthMock = extractAuth as MockedFunction<typeof extractAuth>;
const resolveAuthMock = resolveAuthContext as MockedFunction<typeof resolveAuthContext>;
const createSpacesApiMock = createSpacesApi as MockedFunction<typeof createSpacesApi>;

function ctx(props: Record<string, unknown>) {
  return {
    propsValue: props,
    auth: { baseUrl: 'https://example.test', clientId: 'id', clientSecret: 'secret' },
  } as never;
}

describe('searchParticipatorySpace action', () => {
  const searchSpaces = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    extractAuthMock.mockReturnValue({
      baseUrl: 'https://example.test',
      clientId: 'id',
      clientSecret: 'secret',
    });
    resolveAuthMock.mockResolvedValue({
      rawAccessToken: 'token',
      baseConfiguration: {},
    } as never);
    createSpacesApiMock.mockReturnValue({ searchSpaces } as never);
  });

  it('returns one page when batch is shorter than perPage', async () => {
    searchSpaces.mockResolvedValueOnce({
      data: { data: [{ id: 1 }, { id: 2 }] },
    });

    const out = (await searchParticipatorySpace.run(
      ctx({
        query: 'x',
        perPage: 10,
        maxResults: 500,
      }),
    )) as {
      ok: boolean;
      spaces: unknown[];
      count: number;
      pagesFetched: number;
    };

    expect(out.ok).toBe(true);
    expect(out.spaces).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out.count).toBe(2);
    expect(out.pagesFetched).toBe(1);
    expect(searchSpaces).toHaveBeenCalledTimes(1);
  });

  it('requests another page until maxResults', async () => {
    searchSpaces
      .mockResolvedValueOnce({
        data: { data: [{ id: 0 }, { id: 1 }] },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 99 }] },
      });

    const out = (await searchParticipatorySpace.run(
      ctx({
        query: 'q',
        perPage: 2,
        maxResults: 3,
      }),
    )) as {
      ok: boolean;
      spaces: unknown[];
      pagesFetched: number;
    };

    expect(out.ok).toBe(true);
    expect(out.spaces).toHaveLength(3);
    expect(out.pagesFetched).toBe(2);
    expect(searchSpaces).toHaveBeenCalledTimes(2);
  });

  it('stops when API returns non-array data', async () => {
    searchSpaces.mockResolvedValueOnce({ data: { data: 'bad' as never } });

    const out = (await searchParticipatorySpace.run(
      ctx({ query: 'x', perPage: 10, maxResults: 500 }),
    )) as { ok: boolean; spaces: unknown[]; pagesFetched: number };

    expect(out.ok).toBe(true);
    expect(out.spaces).toEqual([]);
    expect(out.pagesFetched).toBe(1);
  });

  it('returns error when no search criterion', async () => {
    const out = (await searchParticipatorySpace.run(
      ctx({
        query: '',
        spaceType: undefined,
        advancedFilters: undefined,
        perPage: 50,
        maxResults: 500,
      }),
    )) as { ok: boolean; error: string };

    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/Add a title search|advanced filter/i);
    expect(searchSpaces).not.toHaveBeenCalled();
  });
});
