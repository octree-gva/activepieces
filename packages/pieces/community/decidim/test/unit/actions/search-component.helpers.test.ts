import {
  buildSearchComponentsRequestParams as buildComponentParams,
  computeHasMore,
} from '../../../src/lib/domains/components/search-component.helpers';

describe('computeHasMore', () => {
  it('is true when page is full', () => {
    expect(computeHasMore(10, 10)).toBe(true);
  });

  it('is false when page not full', () => {
    expect(computeHasMore(9, 10)).toBe(false);
  });
});

describe('buildSearchComponentsRequestParams', () => {
  it('maps component ids to filterIdIn', () => {
    const { requestParams } = buildComponentParams({
      accessToken: 'tok',
      componentIds: [{ value: 1 }, { value: 2 }],
    });
    expect(requestParams.authorization).toBe('Bearer tok');
    expect(requestParams.filterIdIn).toEqual([1, 2]);
  });

  it('rejects id 0', () => {
    expect(() =>
      buildComponentParams({
        accessToken: 't',
        componentIds: [{ value: 0 }],
      })
    ).toThrow();
  });

  it('maps manifests to filterManifestNameIn', () => {
    const { requestParams } = buildComponentParams({
      accessToken: 'tok',
      componentManifests: [{ value: 'meetings' }, { value: 'proposals' }],
    });
    expect(requestParams.filterManifestNameIn).toEqual(['meetings', 'proposals']);
  });

  it('omits filters when arrays empty', () => {
    const { requestParams, effectivePerPage } = buildComponentParams({
      accessToken: 't',
      page: 1,
      perPage: 50,
    });
    expect(requestParams.filterIdIn).toBeUndefined();
    expect(requestParams.filterManifestNameIn).toBeUndefined();
    expect(effectivePerPage).toBe(50);
  });

  it('includes locales when provided', () => {
    const { requestParams, effectivePerPage } = buildComponentParams({
      accessToken: 't',
      componentManifests: [{ value: 'meetings' }],
      perPage: 10,
      locales: [{ value: 'en' }, { value: 'fr' }],
    });
    expect(effectivePerPage).toBe(10);
    expect(requestParams.locales).toEqual(['en', 'fr']);
  });
});
