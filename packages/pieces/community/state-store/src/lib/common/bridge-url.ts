const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3847';

export function getBridgeUrl(): string {
  const fromEnv = process.env['AP_STATE_STORE_BRIDGE_URL'];
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_BRIDGE_URL;
}

export function getBridgePort(): number {
  const fromEnv = process.env['AP_STATE_STORE_BRIDGE_PORT'];
  if (fromEnv) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3847;
}
