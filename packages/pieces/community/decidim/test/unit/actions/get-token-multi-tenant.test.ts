import { vi } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import { getToken } from '../../../src/lib/domains/users/get-token';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { AppConnectionType } from '@activepieces/pieces-framework';

const { sendRequest } = vi.hoisted(() => ({
  sendRequest: vi.fn(),
}));

vi.mock('@activepieces/pieces-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@activepieces/pieces-common')>();
  return {
    ...actual,
    httpClient: {
      sendRequest,
    },
  };
});

const multiTenantAuth = {
  type: AppConnectionType.CUSTOM_AUTH as AppConnectionType.CUSTOM_AUTH,
  props: {
    name: 'Multi',
    tenants: JSON.stringify({
      'https://first.example': {
        client_id: 'first-id',
        client_secret: 'first-secret',
        scopes: 'oauth',
      },
      'https://second.example': {
        client_id: 'second-id',
        client_secret: 'second-secret',
        scopes: 'public system',
      },
    }),
  },
} as const;

describe('getToken multi-tenant host routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRequest.mockReset();
  });

  it.each([
    [
      'https://first.example',
      'https://first.example/oauth/token',
      'first-id',
      'first-secret',
    ],
    [
      'https://second.example',
      'https://second.example/oauth/token',
      'second-id',
      'second-secret',
    ],
    [
      'https://second.example/',
      'https://second.example/oauth/token',
      'second-id',
      'second-secret',
    ],
  ])(
    'mints on %s with matching credentials',
    async (host, url, clientId, clientSecret) => {
      sendRequest.mockResolvedValueOnce({
        body: { access_token: 'tok' },
      });

      const out = await getToken.run(
        createMockActionContext({
          auth: multiTenantAuth,
          propsValue: {
            host,
            grantType: 'client_credentials',
            scope: 'public system',
          },
        }) as Parameters<typeof getToken.run>[0]
      );

      expect(out.ok).toBe(true);
      expect(sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: HttpMethod.POST,
          url,
          body: expect.objectContaining({
            client_id: clientId,
            client_secret: clientSecret,
          }),
        })
      );
    }
  );

  it('never calls the first host token endpoint when second is selected', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'tok' },
    });

    await getToken.run(
      createMockActionContext({
        auth: multiTenantAuth,
        propsValue: {
          host: 'https://second.example',
          grantType: 'client_credentials',
          scope: 'public',
        },
      }) as Parameters<typeof getToken.run>[0]
    );

    expect(sendRequest.mock.calls[0][0].url).not.toContain('first.example');
  });
});
