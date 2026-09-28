import {
  bearerAuthorization,
  blogSearchPayload,
  buildBlogReadRequest,
  buildBlogsListRequest,
  normalizePagePerPage,
  parseOptionalPositiveInt,
  parseOptionalSpaceManifest,
  parseRequiredPositiveInt,
} from '../../../src/lib/domains/blogs/blog-posts.helpers';

describe('normalizePagePerPage', () => {
  it('defaults page and perPage', () => {
    expect(normalizePagePerPage(undefined, undefined)).toEqual({
      page: 1,
      effectivePerPage: 50,
    });
  });

  it('caps perPage at 100', () => {
    expect(() => normalizePagePerPage(1, 101)).toThrow();
  });
});

describe('bearerAuthorization', () => {
  it('prefixes raw token', () => {
    expect(bearerAuthorization('abc')).toBe('Bearer abc');
  });

  it('leaves existing Bearer prefix', () => {
    expect(bearerAuthorization('Bearer xyz')).toBe('Bearer xyz');
  });
});

describe('parseOptionalSpaceManifest', () => {
  it('accepts participatory_processes', () => {
    expect(parseOptionalSpaceManifest('participatory_processes')).toBe(
      'participatory_processes'
    );
  });

  it('returns undefined for empty', () => {
    expect(parseOptionalSpaceManifest('')).toBeUndefined();
    expect(parseOptionalSpaceManifest(undefined)).toBeUndefined();
  });
});

describe('parseOptionalPositiveInt', () => {
  it('throws for zero', () => {
    expect(() => parseOptionalPositiveInt('X', 0)).toThrow('X must be a positive integer');
  });

  it('parses numeric strings', () => {
    expect(parseOptionalPositiveInt('X', '3')).toBe(3);
  });

  it('returns undefined for null', () => {
    expect(parseOptionalPositiveInt('X', null)).toBeUndefined();
  });
});

describe('parseRequiredPositiveInt', () => {
  it('parses a positive int', () => {
    expect(parseRequiredPositiveInt('Component ID', 9)).toBe(9);
  });

  it('throws when missing', () => {
    expect(() => parseRequiredPositiveInt('Component ID', undefined)).toThrow(
      'Component ID is required'
    );
  });
});

describe('buildBlogsListRequest', () => {
  it('maps component_id to SDK request', () => {
    const { request, effectivePerPage } = buildBlogsListRequest({
      accessToken: 't',
      searchOptions: { componentId: 9 },
    });
    expect(effectivePerPage).toBe(50);
    expect(request).toMatchObject({
      authorization: 'Bearer t',
      page: 1,
      perPage: 50,
      componentId: 9,
    });
  });

  it('forwards page and perPage', () => {
    const { request, effectivePerPage } = buildBlogsListRequest({
      accessToken: 't',
      searchOptions: { componentId: 9, page: 3, perPage: 20 },
    });
    expect(effectivePerPage).toBe(20);
    expect(request).toMatchObject({ page: 3, perPage: 20, componentId: 9 });
  });

  it('requires componentId', () => {
    expect(() =>
      buildBlogsListRequest({
        accessToken: 't',
        searchOptions: {},
      })
    ).toThrow('Component ID is required');
  });
});

describe('blogSearchPayload', () => {
  it('uses meta.count and links.next from the body', () => {
    expect(
      blogSearchPayload({
        body: {
          data: [{ id: 1 }],
          meta: { count: 9 },
          links: { next: '/blogs?page=2' },
        },
        effectivePerPage: 50,
      })
    ).toEqual({
      data: [{ id: 1 }],
      meta: { count: 9 },
      links: { next: '/blogs?page=2' },
      count: 9,
      has_more: true,
    });
  });

  it('falls back to page length and computeHasMore', () => {
    expect(
      blogSearchPayload({
        body: { data: [{ id: 1 }, { id: 2 }] },
        effectivePerPage: 2,
      })
    ).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      count: 2,
      has_more: true,
    });
    expect(
      blogSearchPayload({
        body: { data: [{ id: 1 }] },
        effectivePerPage: 50,
      })
    ).toEqual({
      data: [{ id: 1 }],
      count: 1,
      has_more: false,
    });
    expect(
      blogSearchPayload({
        body: undefined,
        effectivePerPage: 50,
      })
    ).toEqual({ count: 0, has_more: false });
  });
});

describe('buildBlogReadRequest', () => {
  it('requires positive blogPostId', () => {
    expect(() =>
      buildBlogReadRequest({
        accessToken: 't',
        readOptions: { blogPostId: 0 },
      })
    ).toThrow();
  });

  it('builds a read request by id', () => {
    const req = buildBlogReadRequest({
      accessToken: 'tok',
      readOptions: { blogPostId: 42 },
    });
    expect(req).toMatchObject({
      id: 42,
      authorization: 'Bearer tok',
    });
  });
});
