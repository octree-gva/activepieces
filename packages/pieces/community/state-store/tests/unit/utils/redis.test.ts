import { redisConnect } from '../../../src/lib/utils/redis';
import { stateStoreAuth } from '../../../src/stateStoreAuth';
import Redis from 'ioredis';

jest.mock('ioredis');

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
    const auth = {
      props: {
        url: 'redis://localhost:6379',
      },
    } as any;

    const client = await redisConnect(auth);

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    expect(mockRedisInstance.connect).toHaveBeenCalled();
    expect(mockRedisInstance.ping).toHaveBeenCalled();
    expect(client).toBe(mockRedisInstance);
  });

  it('should include tls when useSsl is true', async () => {
    const auth = {
      props: {
        url: 'redis://localhost:6379',
        useSsl: true,
      },
    } as any;

    await redisConnect(auth);

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      tls: {},
    });
  });

  it('should not include tls when useSsl is false', async () => {
    const auth = {
      props: {
        url: 'redis://localhost:6379',
        useSsl: false,
      },
    } as any;

    await redisConnect(auth);

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  });

  it('should not include tls when useSsl is undefined', async () => {
    const auth = {
      props: {
        url: 'redis://localhost:6379',
      },
    } as any;

    await redisConnect(auth);

    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  });

  it('should throw error if URL is missing', async () => {
    const auth = {
      props: {},
    } as any;

    await expect(redisConnect(auth)).rejects.toThrow('Redis URL is required');
  });

  it('should throw error if connection fails', async () => {
    const auth = {
      props: {
        url: 'redis://invalid:6379',
      },
    } as any;

    mockRedisInstance.connect.mockRejectedValue(new Error('Connection failed'));

    await expect(redisConnect(auth)).rejects.toThrow('Failed to connect to Redis: Connection failed');
  });

  it('should throw error if ping fails', async () => {
    const auth = {
      props: {
        url: 'redis://localhost:6379',
      },
    } as any;

    mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));

    await expect(redisConnect(auth)).rejects.toThrow('Failed to connect to Redis: Ping failed');
  });

  it('should handle non-Error exceptions', async () => {
    const auth = {
      props: {
        url: 'redis://localhost:6379',
      },
    } as any;

    mockRedisInstance.connect.mockRejectedValue('String error');

    await expect(redisConnect(auth)).rejects.toThrow('Failed to connect to Redis: Unknown error');
  });
});
