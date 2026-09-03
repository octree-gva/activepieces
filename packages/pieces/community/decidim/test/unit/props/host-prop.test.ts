import { describe, expect, it } from 'vitest';
import { hostProp } from '../../../src/lib/props';
import { AppConnectionType } from '@activepieces/pieces-framework';

async function loadHostOptions(auth: unknown) {
  const prop = hostProp();
  expect(prop.type).toBe('DROPDOWN');
  const optionsFn = prop.options;
  expect(typeof optionsFn).toBe('function');
  return optionsFn({ auth } as never, undefined as never);
}

const twoTenantAuth = {
  type: AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'pack',
    tenants: JSON.stringify({
      'https://a.example/': {
        client_id: 'a',
        client_secret: 'as',
        scopes: 'oauth',
      },
      'https://b.example': {
        client_id: 'b',
        client_secret: 'bs',
        scopes: 'public',
      },
    }),
  },
};

describe('hostProp dropdown', () => {
  it('is required and named Platform host', () => {
    const prop = hostProp();
    expect(prop.required).toBe(true);
    expect(prop.displayName).toBe('Platform host');
    expect(prop.refreshers).toEqual(['auth']);
  });

  it('disables when auth is missing', async () => {
    await expect(loadHostOptions(undefined)).resolves.toEqual({
      disabled: true,
      options: [],
      placeholder: 'Select a Decidim connection first',
    });
  });

  it('disables when auth is null', async () => {
    await expect(loadHostOptions(null)).resolves.toEqual({
      disabled: true,
      options: [],
      placeholder: 'Select a Decidim connection first',
    });
  });

  it('lists normalized hosts from the tenant pack', async () => {
    await expect(loadHostOptions(twoTenantAuth)).resolves.toEqual({
      disabled: false,
      options: [
        { label: 'https://a.example', value: 'https://a.example' },
        { label: 'https://b.example', value: 'https://b.example' },
      ],
    });
  });

  it('lists hosts from flat auth props', async () => {
    await expect(
      loadHostOptions({
        name: 'pack',
        tenants: JSON.stringify({
          'https://only.example': {
            client_id: 'id',
            client_secret: 'secret',
            scopes: 'oauth',
          },
        }),
      })
    ).resolves.toEqual({
      disabled: false,
      options: [
        { label: 'https://only.example', value: 'https://only.example' },
      ],
    });
  });

  it('disables when tenants JSON is invalid', async () => {
    await expect(
      loadHostOptions({
        type: AppConnectionType.CUSTOM_AUTH,
        props: { name: 'pack', tenants: '{broken' },
      })
    ).resolves.toEqual({
      disabled: true,
      options: [],
      placeholder: 'Fix Tenants JSON on the connection',
    });
  });

  it('disables when tenants map is empty', async () => {
    await expect(
      loadHostOptions({
        type: AppConnectionType.CUSTOM_AUTH,
        props: { name: 'pack', tenants: '{}' },
      })
    ).resolves.toEqual({
      disabled: true,
      options: [],
      placeholder: 'Fix Tenants JSON on the connection',
    });
  });

  it('disables on legacy single-tenant connection shape', async () => {
    await expect(
      loadHostOptions({
        type: AppConnectionType.CUSTOM_AUTH,
        props: {
          name: 'legacy',
          baseUrl: 'https://example.com',
          clientId: 'id',
          clientSecret: 'secret',
          scopes: 'oauth',
        },
      })
    ).resolves.toEqual({
      disabled: true,
      options: [],
      placeholder: 'Fix Tenants JSON on the connection',
    });
  });
});
