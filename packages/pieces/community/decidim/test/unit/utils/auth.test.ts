import { AppConnectionType } from '@activepieces/pieces-framework';
import { extractAuth } from '../../../src/lib/utils/auth';

const tenants = JSON.stringify({
  'https://example.com': {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    scopes: 'oauth',
  },
  'https://other.example.com': {
    client_id: 'other-client-id',
    client_secret: 'other-client-secret',
    scopes: 'public oauth',
  },
});

const packAuth = {
  type: AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'My app',
    tenants,
  },
};

describe('extractAuth', () => {
  it('maps host to credentials from the tenant pack', () => {
    expect(
      extractAuth({
        auth: packAuth,
        propsValue: { host: 'https://example.com' },
      })
    ).toEqual({
      name: 'My app',
      baseUrl: 'https://example.com',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scopes: 'oauth',
    });
  });

  it('selects a different tenant when host changes', () => {
    expect(
      extractAuth({
        auth: packAuth,
        propsValue: { host: 'https://other.example.com' },
      }).clientId
    ).toBe('other-client-id');
  });

  it('accepts flat connection props without type wrapper', () => {
    expect(
      extractAuth({
        auth: { name: 'My app', tenants },
        propsValue: { host: 'https://other.example.com' },
      })
    ).toEqual({
      name: 'My app',
      baseUrl: 'https://other.example.com',
      clientId: 'other-client-id',
      clientSecret: 'other-client-secret',
      scopes: 'public oauth',
    });
  });

  it.each([
    ['https://example.com/', 'https://example.com'],
    ['  https://example.com  ', 'https://example.com'],
    ['https://example.com', 'https://example.com'],
  ])('normalizes host %j to %j', (host, expected) => {
    expect(
      extractAuth({ auth: packAuth, propsValue: { host } }).baseUrl
    ).toBe(expected);
  });

  it.each([
    [undefined, 'Auth is required'],
    [null, 'Auth is required'],
  ])('throws when auth is %j', (auth, message) => {
    expect(() =>
      extractAuth({ auth, propsValue: { host: 'https://example.com' } })
    ).toThrow(message);
  });

  it.each([
    [{}, 'Platform host is required'],
    [{ host: '' }, 'Platform host is required'],
    [{ host: '   ' }, 'Platform host is required'],
    [{ host: 12 }, 'Platform host is required'],
    [{ host: null }, 'Platform host is required'],
    [{ host: undefined }, 'Platform host is required'],
  ])('throws when propsValue is %j', (propsValue, message) => {
    expect(() => extractAuth({ auth: packAuth, propsValue })).toThrow(message);
  });

  it('throws when propsValue is omitted', () => {
    expect(() => extractAuth({ auth: packAuth })).toThrow(
      'Platform host is required'
    );
  });

  it('throws when host is unknown (fail closed)', () => {
    expect(() =>
      extractAuth({
        auth: packAuth,
        propsValue: { host: 'https://unknown.example.com' },
      })
    ).toThrow('Unknown platform host: https://unknown.example.com');
  });

  it('never uses the first pack entry when host is wrong', () => {
    expect(() =>
      extractAuth({
        auth: packAuth,
        propsValue: { host: 'https://example.com.evil' },
      })
    ).toThrow('Unknown platform host');
  });

  it('throws when tenants JSON is invalid', () => {
    expect(() =>
      extractAuth({
        auth: { name: 'x', tenants: '{not-json' },
        propsValue: { host: 'https://example.com' },
      })
    ).toThrow('Tenants JSON is invalid');
  });

  it('throws when connection name is missing', () => {
    expect(() =>
      extractAuth({
        auth: { tenants },
        propsValue: { host: 'https://example.com' },
      })
    ).toThrow('Name is required');
  });

  it('throws when tenants field is missing', () => {
    expect(() =>
      extractAuth({
        auth: { name: 'x' },
        propsValue: { host: 'https://example.com' },
      })
    ).toThrow('Tenants JSON is required');
  });

  it('throws on legacy single-tenant shape', () => {
    expect(() =>
      extractAuth({
        auth: {
          type: AppConnectionType.CUSTOM_AUTH,
          props: {
            name: 'legacy',
            baseUrl: 'https://example.com',
            clientId: 'id',
            clientSecret: 'secret',
            scopes: 'oauth',
          },
        },
        propsValue: { host: 'https://example.com' },
      })
    ).toThrow('Tenants JSON is required');
  });
});
