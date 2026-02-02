import { AppConnectionValueForAuthProperty } from '@activepieces/pieces-framework';
import Redis, { RedisOptions } from 'ioredis';
import { stateStoreAuth } from '../..';

export interface RedisConnectionProps {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
  useSsl?: boolean;
  url?: string;
}

export async function redisConnect(
  authWithProps: AppConnectionValueForAuthProperty<typeof stateStoreAuth>
): Promise<Redis> {
  try {
    const auth = authWithProps.props;
    
    if (auth.url) {
      const client = new Redis(auth.url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      await client.connect();
      return client;
    }

    if (!auth.host || !auth.port) {
      throw new Error('Host and port are required when not using URL');
    }

    const redisOptions: RedisOptions = {
      host: auth.host,
      port: auth.port,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };

    if (auth.password) {
      redisOptions.password = auth.password;
    }

    if (auth.username) {
      redisOptions.username = auth.username;
    }

    if (auth.db !== undefined && auth.db !== null) {
      redisOptions.db = auth.db;
    }

    if (auth.useSsl) {
      redisOptions.tls = {};
    }

    const client = new Redis(redisOptions);
    await client.connect();
    return client;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to Redis: ${errorMessage}`);
  }
}
