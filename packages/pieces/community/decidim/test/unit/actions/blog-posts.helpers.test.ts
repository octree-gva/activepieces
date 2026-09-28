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

  it('caps perPage with limit', () => {
    const { request, effectivePerPage } = buildBlogsListRequest({
      accessToken: 't',
      searchOptions: { componentId: 9, perPage: 50, limit: 7 },
    });
    expect(effectivePerPage).toBe(7);
    expect(request).toMatchObject({ perPage: 7 });
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
  it('copies object bodies', () => {
    expect(blogSearchPayload({ data: [1], meta: { page: 1 } })).toEqual({
      data: [1],
      meta: { page: 1 },
    });
  });

  it('returns empty for non-objects', () => {
    expect(blogSearchPayload(undefined)).toEqual({});
    expect(blogSearchPayload([])).toEqual({});
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
