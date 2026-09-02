#!/usr/bin/env npx ts-node

import { getBridgePort } from '../src/lib/common/bridge-url';
import { runBridge } from '../src/lib/bridge/run-bridge';

function parseArgs(): { redisUrl: string; listenPort: number } {
  const args = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const index = args.indexOf(key);
    if (index === -1 || !args[index + 1]) {
      return undefined;
    }
    return args[index + 1];
  };
  const redisUrl =
    get('--redis-url') ??
    process.env['AP_STATE_STORE_REDIS_URL'] ??
    process.env['AP_REDIS_URL'];
  if (!redisUrl) {
    throw new Error('Missing --redis-url, AP_STATE_STORE_REDIS_URL, or AP_REDIS_URL');
  }
  const portArg = get('--listen-port');
  const listenPort = portArg ? Number.parseInt(portArg, 10) : getBridgePort();
  if (Number.isNaN(listenPort) || listenPort <= 0) {
    throw new Error('Invalid --listen-port');
  }
  return { redisUrl, listenPort };
}

async function main(): Promise<void> {
  const { redisUrl, listenPort } = parseArgs();
  await runBridge({ redisUrl, listenPort });
}

main().catch((err) => {
  console.error('[watcher] Fatal:', err);
  process.exit(1);
});
