#!/usr/bin/env npx ts-node

import Redis from 'ioredis';
import { startBridgeHttpServer } from '../src/lib/bridge/run-bridge';
import { getBridgePort } from '../src/lib/common/bridge-url';

async function main(): Promise<void> {
  const redisUrl =
    process.env['AP_STATE_STORE_REDIS_URL'] ?? process.env['AP_REDIS_URL'];
  if (!redisUrl) {
    throw new Error('AP_STATE_STORE_REDIS_URL or AP_REDIS_URL required');
  }
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  redis.on('error', (err) => console.error('[watcher] Redis error:', err));
  await redis.ping();
  console.log('[watcher] Redis connected (HTTP-only mode)');
  await startBridgeHttpServer({
    redis,
    listenPort: getBridgePort(),
  });
}

main().catch((err) => {
  console.error('[watcher] Fatal:', err);
  process.exit(1);
});
