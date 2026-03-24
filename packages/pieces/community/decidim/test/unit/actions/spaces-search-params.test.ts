import { parseLocales } from '../../../src/lib/runtime/locales';
import {
  buildSearchSpacesRequestParams,
  searchParticipatorySpacePropsSchema,
} from '../../../src/lib/domains/spaces/spaces-search-params';

describe('parseLocales', () => {
  it.each([
    ['non-array', 'en'],
    ['empty array', []],
  ] as const)('returns undefined for %s', (_label, input) => {
    expect(parseLocales(input as never)).toBeUndefined();
  });

  it('maps Activepieces rows to locale strings', () => {
    expect(parseLocales([{ value: 'en' }, { value: 'fr' }])).toEqual(['en', 'fr']);
  });
});

describe('buildSearchSpacesRequestParams', () => {
  it('maps id eq and Bearer auth', () => {
    const { requestParams, effectivePerPage } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [{ field: 'id', operator: 'eq', value: 12 }],
      page: 1,
      perPage: 50,
    });
    expect(requestParams.authorization).toBe('Bearer t');
    expect(requestParams.filterIdEq).toBe(12);
    expect(effectivePerPage).toBe(50);
  });

  it.each([
    ['eq', 0],
    ['lt', -1],
  ] as const)('rejects id %s with invalid number', (operator, value) => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'id', operator, value }],
      }),
    ).toThrow(/numeric ID greater than 0|ID must be > 0/i);
  });

  it('rejects id in when value is not an array', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'id', operator: 'in', value: 1 }],
      }),
    ).toThrow(/numeric ID|non-empty list/i);
  });

  it('merges Values into value for title in (row or JSON array)', () => {
    const rowShape = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [
        {
          field: 'title',
          operator: 'in',
          values: [{ value: 'a' }, { value: 'b' }],
        },
      ],
    });
    const jsonShape = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [{ field: 'title', operator: 'in', values: ['a', 'b'] }],
    });
    expect(rowShape.requestParams.filterTitleIn).toEqual(['a', 'b']);
    expect(jsonShape.requestParams.filterTitleIn).toEqual(['a', 'b']);
  });

  it('coerces id in from Values rows', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [
        {
          field: 'id',
          operator: 'in',
          values: [{ value: '10' }, { value: '20' }],
        },
      ],
    });
    expect(requestParams.filterIdIn).toEqual([10, 20]);
  });

  it('uses Value when both Value and Values are set', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [
        {
          field: 'title',
          operator: 'in',
          value: ['x'],
          values: [{ value: 'y' }],
        },
      ],
    });
    expect(requestParams.filterTitleIn).toEqual(['x']);
  });

  it('rejects slug with invalid casing or characters', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'slug', operator: 'eq', value: 'My-Slug' }],
      }),
    ).toThrow(/lowercase|Slug must/i);
  });

  it('maps slug eq when valid', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [{ field: 'slug', operator: 'eq', value: 'my-slug_ok' }],
    });
    expect(requestParams.filterSlugEq).toBe('my-slug_ok');
  });

  it('maps advanced string filters to SDK params', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [
        { field: 'title', operator: 'matches', value: 'budget' },
        { field: 'manifest_name', operator: 'eq', value: 'assemblies' },
        { field: 'slug', operator: 'not_in', value: ['a', 'b'] },
      ],
    });
    expect(requestParams.filterTitleMatches).toBe('budget');
    expect(requestParams.filterManifestNameEq).toBe('assemblies');
    expect(requestParams.filterSlugNotIn).toEqual(['a', 'b']);
  });

  it('passes perPage and locales', () => {
    const { requestParams, effectivePerPage } = buildSearchSpacesRequestParams({
      accessToken: 't',
      query: 'q',
      perPage: 33,
      locales: [{ value: 'en' }],
    });
    expect(effectivePerPage).toBe(33);
    expect(requestParams.locales).toEqual(['en']);
  });

  it('rejects invalid manifest_name for eq', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'manifest_name', operator: 'eq', value: 'processes' }],
      }),
    ).toThrow(/space type|Choose a space type/i);
  });

  it('rejects slug in array with invalid entry', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'slug', operator: 'in', value: ['ok', 'Bad'] }],
      }),
    ).toThrow(/lowercase|hyphens/i);
  });

  it('maps query to contains-style title match', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      query: '  budget  ',
    });
    expect(requestParams.filterTitleMatches).toBe('%budget%');
  });

  it('maps spaceType to filterManifestNameEq', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      spaceType: 'conferences',
    });
    expect(requestParams.filterManifestNameEq).toBe('conferences');
  });

  it('lets query and spaceType override advanced title/manifest', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      advancedFilters: [{ field: 'title', operator: 'matches', value: 'old' }],
      query: 'new',
      spaceType: 'initiatives',
    });
    expect(requestParams.filterTitleMatches).toBe('%new%');
    expect(requestParams.filterManifestNameEq).toBe('initiatives');
  });

  it('requires at least one criterion', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [],
      }),
    ).toThrow(/Add a title search/i);
  });

  it('rejects id with matches operator', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        advancedFilters: [{ field: 'id', operator: 'matches', value: '1' }],
      }),
    ).toThrow();
  });
});

describe('searchParticipatorySpacePropsSchema', () => {
  it('defaults perPage and maxResults', () => {
    const parsed = searchParticipatorySpacePropsSchema.parse({ query: 'x' });
    expect(parsed.perPage).toBe(50);
    expect(parsed.maxResults).toBe(500);
  });

  it.each([
    ['empty object', {}],
    ['whitespace-only query', { query: '   ' }],
  ] as const)('rejects missing criterion (%s)', (_label, input) => {
    expect(() => searchParticipatorySpacePropsSchema.parse(input)).toThrow(/Add a title search/i);
  });
});
