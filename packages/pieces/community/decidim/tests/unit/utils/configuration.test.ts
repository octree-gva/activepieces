import { configuration } from '../../../src/lib/utils/configuration';

describe('configuration', () => {
  it('should create configuration with basePath from baseUrl', () => {
    const result = configuration({ baseUrl: 'https://example.com' });

    expect(result.basePath).toBe('https://example.com/api/rest_full/v0.2');
    expect(result.isJsonMime('application/json')).toBe(true);
  });

  it('should handle baseUrl with trailing slash', () => {
    const result = configuration({ baseUrl: 'https://example.com/' });

    expect(result.basePath).toBe('https://example.com//api/rest_full/v0.2');
  });

  it('should spread additional properties', () => {
    const result = configuration({
      baseUrl: 'https://example.com',
      customProp: 'value',
    }) as any;

    expect(result.customProp).toBe('value');
    expect(result.baseUrl).toBeUndefined();
  });

  it('should always return true for isJsonMime', () => {
    const result = configuration({ baseUrl: 'https://example.com' });

    expect(result.isJsonMime('application/json')).toBe(true);
    expect(result.isJsonMime('text/plain')).toBe(true);
    expect(result.isJsonMime('any/mime')).toBe(true);
  });
});
