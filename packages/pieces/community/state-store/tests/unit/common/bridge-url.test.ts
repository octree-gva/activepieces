import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { bridgeUrl } from '../../../src/lib/common/bridge-url';

jest.mock('@activepieces/pieces-common', () => {
  const actual = jest.requireActual('@activepieces/pieces-common');
  return {
    ...actual,
    httpClient: {
      sendRequest: jest.fn(),
    },
  };
});

describe('bridgeUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['AP_STATE_STORE_BRIDGE_URL'];
    delete process.env['AP_STATE_STORE_BRIDGE_PORT'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('resolve', () => {
    it('prefers auth bridgeUrl and strips trailing slash', () => {
      expect(
        bridgeUrl.resolve({
          auth: { props: { bridgeUrl: 'http://watcher:3847/' } },
        })
      ).toBe('http://watcher:3847');
    });

    it('falls back to env when auth is empty', () => {
      process.env['AP_STATE_STORE_BRIDGE_URL'] = 'http://env:1';
      expect(bridgeUrl.resolve({ auth: { props: { bridgeUrl: '' } } })).toBe(
        'http://env:1'
      );
      expect(bridgeUrl.resolve({ auth: { props: { bridgeUrl: '   ' } } })).toBe(
        'http://env:1'
      );
    });

    it('falls back to default when neither is set', () => {
      expect(bridgeUrl.resolve({})).toBe('http://127.0.0.1:3847');
    });
  });

  describe('getPort', () => {
    it('reads AP_STATE_STORE_BRIDGE_PORT', () => {
      process.env['AP_STATE_STORE_BRIDGE_PORT'] = '4000';
      expect(bridgeUrl.getPort()).toBe(4000);
    });

    it('defaults to 3847', () => {
      expect(bridgeUrl.getPort()).toBe(3847);
    });
  });

  describe('isHealthy', () => {
    it('returns true for 200 { ok: true }', async () => {
      (httpClient.sendRequest as jest.Mock).mockResolvedValueOnce({
        status: 200,
        body: { ok: true },
      });
      await expect(bridgeUrl.isHealthy({ url: 'http://127.0.0.1:3847' })).resolves.toBe(
        true
      );
      expect(httpClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: HttpMethod.GET,
          url: 'http://127.0.0.1:3847/health',
        })
      );
    });

    it('returns false for ok: false', async () => {
      (httpClient.sendRequest as jest.Mock).mockResolvedValueOnce({
        status: 200,
        body: { ok: false },
      });
      await expect(bridgeUrl.isHealthy({ url: 'http://127.0.0.1:3847' })).resolves.toBe(
        false
      );
    });

    it('returns false for non-2xx', async () => {
      (httpClient.sendRequest as jest.Mock).mockResolvedValueOnce({
        status: 500,
        body: { ok: true },
      });
      await expect(bridgeUrl.isHealthy({ url: 'http://127.0.0.1:3847' })).resolves.toBe(
        false
      );
    });

    it('returns false on throw', async () => {
      (httpClient.sendRequest as jest.Mock).mockRejectedValueOnce(new Error('down'));
      await expect(bridgeUrl.isHealthy({ url: 'http://127.0.0.1:3847' })).resolves.toBe(
        false
      );
    });
  });
});
