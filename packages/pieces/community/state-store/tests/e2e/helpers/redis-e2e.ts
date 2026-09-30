import Redis from 'ioredis';

export function e2eRedisUrl(): string {
  const url =
    process.env['AP_STATE_STORE_REDIS_URL'] ??
    process.env['AP_REDIS_URL'] ??
    process.env['E2E_REDIS_URL'];
  if (!url) {
    throw new Error('AP_REDIS_URL / AP_STATE_STORE_REDIS_URL / E2E_REDIS_URL required');
  }
  return url;
}

export function e2eNamespace(): string {
  return process.env['E2E_NAMESPACE'] ?? 'e2e:compose';
}

export async function connectE2eRedis(): Promise<Redis> {
  const redis = new Redis(e2eRedisUrl(), {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    lazyConnect: true,
  });
  await redis.connect();
  await redis.ping();
  return redis;
}

export async function cleanupNamespace({
  redis,
  namespace,
}: {
  redis: Redis;
  namespace: string;
}): Promise<void> {
  if (!redis) {
    return;
  }
  const keys = await redis.keys(`${namespace}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
