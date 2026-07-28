import { parseLocales } from '../../../src/lib/runtime/locales';
import { buildSearchSpacesRequestParams } from '../../../src/lib/domains/spaces/spaces-search-params';

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
  it('maps space ids to filterIdIn', () => {
    const { requestParams, effectivePerPage } = buildSearchSpacesRequestParams({
      accessToken: 't',
      spaceIds: [{ value: 12 }, { value: 34 }],
      page: 1,
      perPage: 10,
    });
    expect(requestParams.authorization).toBe('Bearer t');
    expect(requestParams.filterIdIn).toEqual([12, 34]);
    expect(effectivePerPage).toBe(10);
  });

  it('rejects id 0', () => {
    expect(() =>
      buildSearchSpacesRequestParams({
        accessToken: 't',
        spaceIds: [{ value: 0 }],
      })
    ).toThrow();
  });

  it('maps manifests to filterManifestNameIn', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      spaceManifests: [{ value: 'assemblies' }, { value: 'conferences' }],
    });
    expect(requestParams.filterManifestNameIn).toEqual(['assemblies', 'conferences']);
  });

  it('defaults perPage to 10 and omits empty filters', () => {
    const { requestParams, effectivePerPage } = buildSearchSpacesRequestParams({
      accessToken: 't',
    });
    expect(effectivePerPage).toBe(10);
    expect(requestParams.filterIdIn).toBeUndefined();
    expect(requestParams.filterManifestNameIn).toBeUndefined();
  });

  it('passes locales', () => {
    const { requestParams } = buildSearchSpacesRequestParams({
      accessToken: 't',
      locales: [{ value: 'en' }],
    });
    expect(requestParams.locales).toEqual(['en']);
  });
});
