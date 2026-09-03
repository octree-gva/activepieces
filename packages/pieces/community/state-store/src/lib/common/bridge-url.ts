import { httpClient, HttpMethod } from '@activepieces/pieces-common';

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3847';
const HEALTH_TIMEOUT_MS = 1500;

function getPort(): number {
  const fromEnv = process.env['AP_STATE_STORE_BRIDGE_PORT'];
  if (fromEnv) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3847;
}

function resolve({
  auth,
}: {
  auth?: { props?: { bridgeUrl?: unknown } };
}): string {
  const fromAuth = auth?.props?.bridgeUrl;
  if (typeof fromAuth === 'string' && fromAuth.trim().length > 0) {
    return fromAuth.trim().replace(/\/$/, '');
  }
  const fromEnv = process.env['AP_STATE_STORE_BRIDGE_URL'];
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return DEFAULT_BRIDGE_URL;
}

async function isHealthy({ url }: { url: string }): Promise<boolean> {
  try {
    const response = await httpClient.sendRequest<{ ok?: boolean }>({
      method: HttpMethod.GET,
      url: `${url.replace(/\/$/, '')}/health`,
      timeout: HEALTH_TIMEOUT_MS,
    });
    return response.status >= 200 && response.status < 300 && response.body?.ok === true;
  } catch {
    return false;
  }
}

export const bridgeUrl = {
  resolve,
  getPort,
  isHealthy,
  DEFAULT_BRIDGE_URL,
  HEALTH_TIMEOUT_MS,
};

export function getBridgePort(): number {
  return bridgeUrl.getPort();
}
