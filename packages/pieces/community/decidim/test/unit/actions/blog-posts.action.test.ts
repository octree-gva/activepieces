import { vi } from 'vitest';
import { blogPosts } from '../../../src/lib/domains/blogs/blog-posts';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { listBlogPosts, blogShowPagination } = vi.hoisted(() => ({
  listBlogPosts: vi.fn(),
  blogShowPagination: vi.fn(),
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
  createBlogsApi: vi.fn().mockReturnValue({
    listBlogPosts,
    blogShowPagination,
  }),
}));

function run(props: Record<string, unknown>) {
  return blogPosts.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof blogPosts.run>[0]
  );
}

describe('blogPosts action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBlogPosts.mockReset();
    blogShowPagination.mockReset();
  });

  it('search lists posts by component_id', async () => {
    listBlogPosts.mockResolvedValueOnce({
      data: { data: [{ id: 1 }, { id: 2 }], meta: { count: 2 } },
    });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9, perPage: 2 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out.meta).toEqual({ count: 2 });
    expect(listBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ componentId: 9 })
    );
  });

  it('search forwards page and perPage', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: { data: [] } });
    await run({
      action: 'search',
      searchOptions: { componentId: 9, page: 2, perPage: 20 },
    });
    expect(listBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ componentId: 9, page: 2, perPage: 20 })
    );
  });

  it('search allows missing componentId', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: { data: [] } });
    const out = await run({ action: 'search', searchOptions: {} });
    expect(out.ok).toBe(true);
    expect(listBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 50 })
    );
  });

  it('search passes through undefined body as empty object', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: undefined });
    const out = await run({ action: 'search', searchOptions: { componentId: 1 } });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toBeUndefined();
  });

  it('search defaults missing searchOptions', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: { data: [] } });
    const out = await run({ action: 'search' });
    expect(out.ok).toBe(true);
  });

  it('search forwards consolidated sort', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: { data: [] } });
    await run({
      action: 'search',
      searchOptions: { order: 'published_at:asc' },
    });
    expect(listBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'published_at', orderDirection: 'asc' })
    );
  });

  it('read requires blogPostId', async () => {
    const out = await run({ action: 'read' });
    expect(out.ok).toBe(false);
  });

  it('returns error when the API throws', async () => {
    listBlogPosts.mockRejectedValueOnce(new Error('boom'));
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 1 },
    });
    expect(out.ok).toBe(false);
  });

  it('read returns server body as-is', async () => {
    blogShowPagination.mockResolvedValueOnce({ data: { data: { id: 42 } } });
    const out = await run({
      action: 'read',
      readOptions: { blogPostId: 42 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.data).toEqual({ id: 42 });
  });

  it('returns error for unknown action', async () => {
    const out = await run({ action: 'delete' });
    expect(out.ok).toBe(false);
  });

  it('exposes search fields only for search and blogPostId only for read', async () => {
    const search = await loadDynamicProps(blogPosts.props.searchOptions, {
      action: 'search',
    });
    expect(Object.keys(search)).toEqual(['componentId', 'page', 'perPage', 'order']);
    expect(await loadDynamicProps(blogPosts.props.searchOptions, { action: 'read' })).toEqual({});

    const read = await loadDynamicProps(blogPosts.props.readOptions, { action: 'read' });
    expect(read).toHaveProperty('blogPostId');
    expect(await loadDynamicProps(blogPosts.props.readOptions, { action: 'search' })).toEqual({});
  });
});
