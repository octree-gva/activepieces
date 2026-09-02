import { vi } from 'vitest';
import { blogPosts } from '../../../src/lib/domains/blogs/blog-posts';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { listBlogPosts, getBlogPost } = vi.hoisted(() => ({
  listBlogPosts: vi.fn(),
  getBlogPost: vi.fn(),
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
    getBlogPost,
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
    getBlogPost.mockReset();
  });

  it('search lists posts by component_id', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: { data: [{ id: 1 }] } });
    const out = await run({
      action: 'search',
      searchOptions: { componentId: 9 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.posts).toEqual([{ id: 1 }]);
    expect(listBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ componentId: 9 })
    );
  });

  it('search requires componentId', async () => {
    const out = await run({ action: 'search', searchOptions: {} });
    expect(out.ok).toBe(false);
  });

  it('search treats missing data as empty', async () => {
    listBlogPosts.mockResolvedValueOnce({ data: {} });
    const out = await run({ action: 'search', searchOptions: { componentId: 1 } });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.posts).toEqual([]);
  });

  it('search defaults missing searchOptions', async () => {
    const out = await run({ action: 'search' });
    expect(out.ok).toBe(false);
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

  it('read loads one post by id', async () => {
    getBlogPost.mockResolvedValueOnce({ data: { data: { id: 42 } } });
    const out = await run({
      action: 'read',
      readOptions: { blogPostId: 42 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.post).toEqual({ id: 42 });
  });

  it('returns error for unknown action', async () => {
    const out = await run({ action: 'delete' });
    expect(out.ok).toBe(false);
  });

  it('exposes componentId only for search and blogPostId only for read', async () => {
    const search = await loadDynamicProps(blogPosts.props.searchOptions, {
      action: 'search',
    });
    expect(search).toHaveProperty('componentId');
    expect(Object.keys(search)).toEqual(['componentId']);
    expect(await loadDynamicProps(blogPosts.props.searchOptions, { action: 'read' })).toEqual({});

    const read = await loadDynamicProps(blogPosts.props.readOptions, { action: 'read' });
    expect(read).toHaveProperty('blogPostId');
    expect(await loadDynamicProps(blogPosts.props.readOptions, { action: 'search' })).toEqual({});
  });
});
