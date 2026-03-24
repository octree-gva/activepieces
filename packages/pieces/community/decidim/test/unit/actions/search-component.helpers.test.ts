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
  it('rejects id eq 0', () => {
    expect(() =>
      buildComponentParams({
        accessToken: 't',
        advancedFilters: [{ field: 'id', operator: 'eq', value: 0 }],
      })
    ).toThrow(/number > 0|ID must be > 0/);
  });

  it('rejects id lt negative', () => {
    expect(() =>
      buildComponentParams({
        accessToken: 't',
        advancedFilters: [{ field: 'id', operator: 'lt', value: -1 }],
      })
    ).toThrow();
  });

  it('rejects participatory_space_id eq 0', () => {
    expect(() =>
      buildComponentParams({
        accessToken: 't',
        advancedFilters: [{ field: 'participatory_space_id', operator: 'eq', value: '0' }],
      })
    ).toThrow();
  });

  it('maps manifest_name in to filterManifestNameIn', () => {
    const { requestParams } = buildComponentParams({
      accessToken: 'tok',
      advancedFilters: [{ field: 'manifest_name', operator: 'in', value: ['meetings'] }],
    });
    expect(requestParams.authorization).toBe('Bearer tok');
    expect(requestParams.filterManifestNameIn).toEqual(['meetings']);
  });

  it('maps participatory_space_type_eq Decidim class', () => {
    const { requestParams } = buildComponentParams({
      accessToken: 't',
      advancedFilters: [
        {
          field: 'participatory_space_type',
          operator: 'eq',
          value: 'Decidim::ParticipatoryProcess',
        },
      ],
    });
    expect(requestParams.filterParticipatorySpaceTypeEq).toBe(
      'Decidim::ParticipatoryProcess'
    );
  });

  it('maps name matches and name in', () => {
    const { requestParams } = buildComponentParams({
      accessToken: 't',
      advancedFilters: [
        { field: 'name', operator: 'matches', value: '%proposal%' },
        { field: 'name', operator: 'in', value: ['Proposals', 'Ideas'] },
      ],
    });
    expect(requestParams.filterNameMatches).toBe('%proposal%');
    expect(requestParams.filterNameIn).toEqual(['Proposals', 'Ideas']);
  });

  it('includes locales when provided', () => {
    const { requestParams, effectivePerPage } = buildComponentParams({
      accessToken: 't',
      advancedFilters: [{ field: 'manifest_name', operator: 'eq', value: 'meetings' }],
      perPage: 10,
      locales: [{ value: 'en' }, { value: 'fr' }],
    });
    expect(effectivePerPage).toBe(10);
    expect(requestParams.locales).toEqual(['en', 'fr']);
  });
});
