import { AppConnectionValueForAuthProperty } from '@activepieces/pieces-framework';
import Redis, { RedisOptions } from 'ioredis';
import { stateStoreAuth } from '../../stateStoreAuth';

export async function createRedisClient(url: string, useSsl?: boolean): Promise<Redis> {
  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
  if (useSsl) {
    redisOptions.tls = {};
  }
  const client = new Redis(url, redisOptions);
  await client.connect();
  await client.ping();
  return client;
}

export async function redisConnect(
  authWithProps: AppConnectionValueForAuthProperty<typeof stateStoreAuth>
): Promise<Redis> {
  try {
    const auth = authWithProps.props;
    if (!auth.url) {
      throw new Error('Redis URL is required');
    }
    return await createRedisClient(auth.url, auth.useSsl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to Redis: ${errorMessage}`);
  }
}
