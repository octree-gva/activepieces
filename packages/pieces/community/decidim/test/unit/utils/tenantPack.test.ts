import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isHttpUrl,
  listTenantHosts,
  normalizeHost,
  parseTenantsJson,
  readConnectionProps,
  resolveTenantAuth,
} from '../../../src/lib/utils/tenantPack';

const entry = (overrides?: Partial<{ client_id: string; client_secret: string; scopes: string }>) => ({
  client_id: 'id',
  client_secret: 'secret',
  scopes: 'oauth',
  ...overrides,
});

const pack = (hosts: Record<string, ReturnType<typeof entry>>) => JSON.stringify(hosts);

describe('normalizeHost', () => {
  it.each([
    ['https://a.example/', 'https://a.example'],
    ['https://a.example', 'https://a.example'],
    ['  https://a.example/  ', 'https://a.example'],
    ['http://localhost:3000/', 'http://localhost:3000'],
    ['https://a.example/path/', 'https://a.example/path'],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });
});

describe('isHttpUrl', () => {
  it.each([
    ['https://a.example', true],
    ['http://a.example', true],
    ['https://a.example:8443', true],
    ['ftp://a.example', false],
    ['not-a-url', false],
    ['', false],
    ['://missing-scheme', false],
    ['javascript:alert(1)', false],
  ])('%j → %s', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });
});

describe('parseTenantsJson', () => {
  it('accepts multiple hosts and normalizes keys', () => {
    expect(
      parseTenantsJson(
        pack({
          'https://a.example/': entry({ client_id: 'a' }),
          'https://b.example': entry({ client_id: 'b', scopes: 'public' }),
        })
      )
    ).toEqual({
      'https://a.example': entry({ client_id: 'a' }),
      'https://b.example': entry({ client_id: 'b', scopes: 'public' }),
    });
  });

  it.each([
    [undefined, 'Tenants JSON is required'],
    [null, 'Tenants JSON is required'],
    [12, 'Tenants JSON is required'],
    ['', 'Tenants JSON is required'],
    ['   ', 'Tenants JSON is required'],
    ['{not-json', 'Tenants JSON is invalid'],
    ['[]', 'Tenants JSON must be an object keyed by host URL'],
    ['null', 'Tenants JSON must be an object keyed by host URL'],
    ['"string"', 'Tenants JSON must be an object keyed by host URL'],
    ['{}', 'Tenants map must include at least one host'],
  ])('rejects %j', (raw, message) => {
    expect(() => parseTenantsJson(raw)).toThrow(message);
  });

  it('rejects missing client_id', () => {
    expect(() =>
      parseTenantsJson(
        JSON.stringify({
          'https://a.example': { client_secret: 's', scopes: 'oauth' },
        })
      )
    ).toThrow();
  });

  it('rejects empty client_id', () => {
    expect(() =>
      parseTenantsJson(pack({ 'https://a.example': entry({ client_id: '' }) }))
    ).toThrow();
  });

  it('rejects missing client_secret', () => {
    expect(() =>
      parseTenantsJson(
        JSON.stringify({
          'https://a.example': { client_id: 'id', scopes: 'oauth' },
        })
      )
    ).toThrow();
  });

  it('rejects empty scopes', () => {
    expect(() =>
      parseTenantsJson(pack({ 'https://a.example': entry({ scopes: '' }) }))
    ).toThrow();
  });

  it('rejects non-URL keys', () => {
    expect(() => parseTenantsJson(pack({ 'not-a-url': entry() }))).toThrow(
      'Invalid host URL'
    );
  });

  it('rejects ftp keys', () => {
    expect(() => parseTenantsJson(pack({ 'ftp://a.example': entry() }))).toThrow(
      'Invalid host URL'
    );
  });

  it('rejects duplicate hosts after slash normalization', () => {
    expect(() =>
      parseTenantsJson(
        pack({
          'https://a.example': entry({ client_id: 'one' }),
          'https://a.example/': entry({ client_id: 'two' }),
        })
      )
    ).toThrow('Duplicate host after normalization: https://a.example');
  });

  it('rejects duplicate hosts after trim normalization', () => {
    expect(() =>
      parseTenantsJson(
        JSON.stringify({
          'https://a.example': entry({ client_id: 'one' }),
          '  https://a.example  ': entry({ client_id: 'two' }),
        })
      )
    ).toThrow('Duplicate host after normalization');
  });
});

describe('listTenantHosts', () => {
  it('returns all normalized host keys in insertion order', () => {
    expect(
      listTenantHosts(
        pack({
          'https://z.example/': entry(),
          'https://a.example': entry(),
        })
      )
    ).toEqual(['https://z.example', 'https://a.example']);
  });
});

describe('resolveTenantAuth', () => {
  const tenantsRaw = pack({
    'https://a.example': entry({ client_id: 'a-id', scopes: 'oauth' }),
    'https://b.example': entry({
      client_id: 'b-id',
      client_secret: 'b-secret',
      scopes: 'public system',
    }),
  });

  it('maps the matching host', () => {
    expect(
      resolveTenantAuth({ tenantsRaw, host: 'https://b.example', name: 'pack' })
    ).toEqual({
      name: 'pack',
      baseUrl: 'https://b.example',
      clientId: 'b-id',
      clientSecret: 'b-secret',
      scopes: 'public system',
    });
  });

  it('normalizes trailing slash on lookup', () => {
    expect(
      resolveTenantAuth({ tenantsRaw, host: 'https://a.example/' }).clientId
    ).toBe('a-id');
  });

  it.each([
    [undefined, 'Platform host is required'],
    [null, 'Platform host is required'],
    [12, 'Platform host is required'],
    ['', 'Platform host is required'],
    ['   ', 'Platform host is required'],
    ['https://missing.example', 'Unknown platform host: https://missing.example'],
  ])('fails closed for host %j', (host, message) => {
    expect(() => resolveTenantAuth({ tenantsRaw, host })).toThrow(message);
  });

  it('never falls back to the first host when another is requested', () => {
    expect(() =>
      resolveTenantAuth({ tenantsRaw, host: 'https://c.example' })
    ).toThrow('Unknown platform host: https://c.example');
  });

  it('omits name when not provided', () => {
    expect(
      resolveTenantAuth({ tenantsRaw, host: 'https://a.example' })
    ).not.toHaveProperty('name');
  });
});

describe('readConnectionProps', () => {
  it('reads flat props', () => {
    expect(readConnectionProps({ name: 'x', tenants: '{}' })).toEqual({
      name: 'x',
      tenants: '{}',
    });
  });

  it('reads wrapped CUSTOM_AUTH props', () => {
    expect(
      readConnectionProps({
        type: 'CUSTOM_AUTH',
        props: { name: 'x', tenants: '{"a":1}' },
      })
    ).toEqual({ name: 'x', tenants: '{"a":1}' });
  });

  it.each([
    [undefined, 'Auth is required'],
    [null, 'Auth is required'],
    [{ tenants: '{}' }, 'Name is required'],
    [{ name: '', tenants: '{}' }, 'Name is required'],
    [{ name: '   ', tenants: '{}' }, 'Name is required'],
    [{ name: 'x' }, 'Tenants JSON is required'],
    [{ name: 'x', tenants: 12 }, 'Tenants JSON is required'],
  ])('rejects %j', (auth, message) => {
    expect(() => readConnectionProps(auth)).toThrow(message);
  });
});

describe('decidimAuth.validate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports every failing host and keeps going', async () => {
    const calls: string[] = [];
    vi.doMock('../../../src/lib/utils/clientCredentialsToken', () => ({
      fetchDecidimClientCredentialsToken: vi.fn(async (auth: { baseUrl: string }) => {
        calls.push(auth.baseUrl);
        if (auth.baseUrl.includes('bad')) {
          throw new Error('fail');
        }
        return 'token';
      }),
    }));
    const { decidimAuth } = await import('../../../src/decidimAuth');
    const result = await decidimAuth.validate!({
      auth: {
        name: 'pack',
        tenants: pack({
          'https://good.example': entry(),
          'https://bad-one.example': entry(),
          'https://bad-two.example': entry(),
        }),
      },
    });
    expect(calls).toEqual([
      'https://good.example',
      'https://bad-one.example',
      'https://bad-two.example',
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('https://bad-one.example: invalid credentials');
      expect(result.error).toContain('https://bad-two.example: invalid credentials');
      expect(result.error).not.toContain('client_secret');
      expect(result.error).not.toContain('"secret"');
    }
  });

  it('returns valid when every host succeeds', async () => {
    vi.doMock('../../../src/lib/utils/clientCredentialsToken', () => ({
      fetchDecidimClientCredentialsToken: vi.fn(async () => 'token'),
    }));
    const { decidimAuth } = await import('../../../src/decidimAuth');
    const result = await decidimAuth.validate!({
      auth: {
        name: 'pack',
        tenants: pack({
          'https://a.example': entry(),
          'https://b.example': entry(),
        }),
      },
    });
    expect(result).toEqual({ valid: true });
  });

  it('rejects invalid tenants JSON without calling token mint', async () => {
    const mint = vi.fn();
    vi.doMock('../../../src/lib/utils/clientCredentialsToken', () => ({
      fetchDecidimClientCredentialsToken: mint,
    }));
    const { decidimAuth } = await import('../../../src/decidimAuth');
    const result = await decidimAuth.validate!({
      auth: { name: 'pack', tenants: '{broken' },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Tenants JSON is invalid');
    }
    expect(mint).not.toHaveBeenCalled();
  });

  it('rejects empty tenants map', async () => {
    vi.doMock('../../../src/lib/utils/clientCredentialsToken', () => ({
      fetchDecidimClientCredentialsToken: vi.fn(),
    }));
    const { decidimAuth } = await import('../../../src/decidimAuth');
    const result = await decidimAuth.validate!({
      auth: { name: 'pack', tenants: '{}' },
    });
    expect(result.valid).toBe(false);
  });

  it('getConnectionIdentifier returns trimmed name', async () => {
    vi.doMock('../../../src/lib/utils/clientCredentialsToken', () => ({
      fetchDecidimClientCredentialsToken: vi.fn(async () => 'token'),
    }));
    const { decidimAuth } = await import('../../../src/decidimAuth');
    expect(
      await decidimAuth.getConnectionIdentifier!({
        auth: { name: '  My pack  ', tenants: pack({ 'https://a.example': entry() }) },
      })
    ).toBe('My pack');
  });
});
