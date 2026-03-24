import {
  bearerAuthorization,
  buildBlogReadRequest,
  buildBlogsListRequest,
  normalizePagePerPage,
  parseOptionalPositiveInt,
  parseOptionalSpaceManifest,
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
});

describe('buildBlogsListRequest', () => {
  it('maps filters and locales to SDK request', () => {
    const { request, effectivePerPage } = buildBlogsListRequest({
      accessToken: 't',
      searchOptions: {
        page: 2,
        perPage: 10,
        locales: [{ value: 'en' }],
        spaceManifest: 'participatory_processes',
        spaceId: 3,
        componentId: 9,
        order: 'published_at',
        orderDirection: 'desc',
      },
    });
    expect(effectivePerPage).toBe(10);
    expect(request).toMatchObject({
      authorization: 'Bearer t',
      page: 2,
      perPage: 10,
      locales: ['en'],
      spaceManifest: 'participatory_processes',
      spaceId: 3,
      componentId: 9,
      order: 'published_at',
      orderDirection: 'desc',
    });
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

  it('includes optional scope fields', () => {
    const req = buildBlogReadRequest({
      accessToken: 'tok',
      readOptions: {
        blogPostId: 42,
        componentId: 7,
        order: 'published_at',
        orderDirection: 'asc',
      },
    });
    expect(req).toMatchObject({
      id: 42,
      authorization: 'Bearer tok',
      componentId: 7,
      order: 'published_at',
      orderDirection: 'asc',
    });
  });
});
