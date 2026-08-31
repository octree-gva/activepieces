import { redisConnect } from '../../../src/lib/utils/redis';
import Redis from 'ioredis';
import { AppConnectionType, AppConnectionValueForAuthProperty } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../../src/stateStoreAuth';

jest.mock('ioredis');

type StateStoreAuthValue = AppConnectionValueForAuthProperty<typeof stateStoreAuth>;

function authWith(props: Partial<StateStoreAuthValue['props']>): StateStoreAuthValue {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: {
      url: 'redis://localhost:6379',
      useSsl: false,
      namespace: 'test',
      fsm: JSON.stringify({ initial: 'START', transitions: { START: [] } }),
      ...props,
    },
  };
}

describe('redisConnect', () => {
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
    } as unknown as jest.Mocked<Redis>;
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
  });

  it('should connect using URL', async () => {
    const client = await redisConnect(authWith({ url: 'redis://localhost:6379' }));

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    expect(mockRedisInstance.connect).toHaveBeenCalled();
    expect(mockRedisInstance.ping).toHaveBeenCalled();
    expect(client).toBe(mockRedisInstance);
  });

  it('should include tls when useSsl is true', async () => {
    await redisConnect(authWith({ url: 'redis://localhost:6379', useSsl: true }));

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      tls: {},
    });
  });

  it('should not include tls when useSsl is false', async () => {
    await redisConnect(authWith({ url: 'redis://localhost:6379', useSsl: false }));

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  });

  it('should not include tls when useSsl is undefined', async () => {
    await redisConnect(authWith({ url: 'redis://localhost:6379', useSsl: undefined }));

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  });

  it('should throw error if URL is missing', async () => {
    await expect(
      redisConnect(authWith({ url: '' }))
    ).rejects.toThrow('Redis URL is required');
  });

  it('should throw error if connection fails', async () => {
    mockRedisInstance.connect.mockRejectedValue(new Error('Connection failed'));

    await expect(
      redisConnect(authWith({ url: 'redis://invalid:6379' }))
    ).rejects.toThrow('Failed to connect to Redis: Connection failed');
  });

  it('should throw error if ping fails', async () => {
    mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));

    await expect(
      redisConnect(authWith({ url: 'redis://localhost:6379' }))
    ).rejects.toThrow('Failed to connect to Redis: Ping failed');
  });

  it('should handle non-Error exceptions', async () => {
    mockRedisInstance.connect.mockRejectedValue('String error');

    await expect(
      redisConnect(authWith({ url: 'redis://localhost:6379' }))
    ).rejects.toThrow('Failed to connect to Redis: Unknown error');
  });
});
