import { vi } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import { getToken } from '../../../src/lib/domains/users/get-token';
import {
  createMockActionContext,
  loadDynamicProps,
} from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

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

function run(props: Record<string, unknown>) {
  return getToken.run(
    createMockActionContext({
      auth: decidimCustomAuth,
      propsValue: props,
    }) as Parameters<typeof getToken.run>[0]
  );
}

describe('getToken action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRequest.mockReset();
  });

  it('requests a client credentials token and returns accessToken', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'cc-token' },
    });

    const out = await run({
      grantType: 'client_credentials',
      scope: 'public system',
    });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.accessToken).toBe('cc-token');
    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: HttpMethod.POST,
        url: 'https://example.decidim.com/oauth/token',
        headers: { 'Content-Type': 'application/json' },
        body: {
          grant_type: 'client_credentials',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          scope: 'public system',
        },
      })
    );
    expect(getToken.displayName).toBe('Get Token');
  });

  it('strips a trailing slash from the base URL', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'cc-token' },
    });

    await getToken.run(
      createMockActionContext({
        auth: {
          ...decidimCustomAuth,
          props: {
            ...decidimCustomAuth.props,
            baseUrl: 'https://example.decidim.com/',
          },
        },
        propsValue: {
          grantType: 'client_credentials',
          scope: 'public',
        },
      }) as Parameters<typeof getToken.run>[0]
    );

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.decidim.com/oauth/token',
      })
    );
  });

  it('requests an ROPC impersonation token', async () => {
    sendRequest.mockResolvedValueOnce({
      body: { access_token: 'ropc-token' },
    });

    const out = await run({
      grantType: 'password',
      scope: 'public oauth whatsapp',
      ropcOptions: { nickname: 'alice' },
    });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.accessToken).toBe('ropc-token');
    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.decidim.com/oauth/token',
        body: {
          grant_type: 'password',
          auth_type: 'impersonate',
          username: 'alice',
          meta: {
            register_on_missing: true,
            accept_tos_on_register: true,
            skip_confirmation_on_register: true,
          },
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          scope: 'public oauth whatsapp',
        },
      })
    );
  });

  it('fails ROPC without a nickname', async () => {
    const out = await run({
      grantType: 'password',
      scope: 'public oauth whatsapp',
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.accessToken).toBeNull();
    expect(out.error).toBe('Nickname is required');
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it('fails ROPC when nickname is not a string', async () => {
    const out = await run({
      grantType: 'password',
      scope: 'public oauth whatsapp',
      ropcOptions: { nickname: 12 },
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error).toBe('Nickname is required');
  });

  it('fails ROPC when ropcOptions is not an object', async () => {
    const out = await run({
      grantType: 'password',
      scope: 'public oauth whatsapp',
      ropcOptions: 'alice',
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error).toBe('Nickname is required');
  });

  it('fails when grant type is invalid', async () => {
    const out = await run({
      grantType: 'refresh_token',
      scope: 'public',
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it('fails when the OAuth response has no access_token', async () => {
    sendRequest.mockResolvedValueOnce({ body: {} });
    const out = await run({
      grantType: 'client_credentials',
      scope: 'public',
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.accessToken).toBeNull();
    expect(out.error).toBe('Decidim OAuth response did not include access_token');
  });

  it('returns the HTTP error message when the request throws', async () => {
    sendRequest.mockRejectedValueOnce(new Error('boom'));
    const out = await run({
      grantType: 'client_credentials',
      scope: 'public',
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error).toBe('boom');
  });

  it('shows nickname only for ROPC', async () => {
    const ropc = await loadDynamicProps(getToken.props.ropcOptions, {
      grantType: 'password',
    });
    expect(ropc).toHaveProperty('nickname');

    const clientCredentials = await loadDynamicProps(getToken.props.ropcOptions, {
      grantType: 'client_credentials',
    });
    expect(clientCredentials).toEqual({});
  });
});
