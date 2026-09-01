import Redis from 'ioredis';
import { webhookRegistry } from '../../../src/lib/common/webhook-registry';

type MockStore = {
  hash: Record<string, Record<string, string>>;
  sets: Record<string, Set<string>>;
  strings: Record<string, string>;
};

function createMockRedis(store: MockStore): Redis {
  return {
    hset: jest.fn(async (key: string, field: string, value: string) => {
      if (!store.hash[key]) {
        store.hash[key] = {};
      }
      store.hash[key][field] = value;
      return 1;
    }),
    hget: jest.fn(async (key: string, field: string) => store.hash[key]?.[field] ?? null),
    hgetall: jest.fn(async (key: string) => store.hash[key] ?? {}),
    hdel: jest.fn(async (key: string, field: string) => {
      if (!store.hash[key]?.[field]) {
        return 0;
      }
      delete store.hash[key][field];
      return 1;
    }),
    sadd: jest.fn(async (key: string, member: string) => {
      if (!store.sets[key]) {
        store.sets[key] = new Set();
      }
      const before = store.sets[key].size;
      store.sets[key].add(member);
      return store.sets[key].size > before ? 1 : 0;
    }),
    srem: jest.fn(async (key: string, member: string) => {
      if (!store.sets[key]?.has(member)) {
        return 0;
      }
      store.sets[key].delete(member);
      return 1;
    }),
    smembers: jest.fn(async (key: string) => Array.from(store.sets[key] ?? [])),
    get: jest.fn(async (key: string) => store.strings[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.strings[key] = value;
      return 'OK';
    }),
  } as unknown as Redis;
}

describe('webhookRegistry', () => {
  describe('serializeSubscriber / parseSubscriber', () => {
    it('roundtrips a valid subscriber', () => {
      const subscriber = {
        id: 'sub-1',
        url: 'http://localhost/webhook',
        namespace: 'bot:test',
        stateFilter: 'MENU',
      };
      const raw = webhookRegistry.serializeSubscriber(subscriber);
      expect(webhookRegistry.parseSubscriber(raw)).toEqual(subscriber);
    });

    it('rejects invalid JSON', () => {
      expect(webhookRegistry.parseSubscriber('not-json')).toBeNull();
    });

    it('rejects garbage shape', () => {
      expect(webhookRegistry.parseSubscriber(JSON.stringify({ foo: 'bar' }))).toBeNull();
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('writes subscriber and namespace set', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      const subscriber = await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: null,
        },
      });
      expect(subscriber.id).toBeTruthy();
      expect(store.hash[webhookRegistry.SUBSCRIBERS_KEY][subscriber.id]).toBeTruthy();
      expect(store.sets[webhookRegistry.NAMESPACES_KEY]?.has('bot:a')).toBe(true);
    });

    it('removes subscriber and namespace when last', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      const subscriber = await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:b',
          stateFilter: 'START',
        },
      });
      await webhookRegistry.unsubscribe({ redis, id: subscriber.id });
      expect(store.hash[webhookRegistry.SUBSCRIBERS_KEY][subscriber.id]).toBeUndefined();
      expect(store.sets[webhookRegistry.NAMESPACES_KEY]?.has('bot:b')).toBe(false);
    });

    it('does not throw when unsubscribing unknown id', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      await expect(
        webhookRegistry.unsubscribe({ redis, id: 'missing' })
      ).resolves.toBeUndefined();
    });
  });

  describe('matchSubscribers', () => {
    const subscribers = [
      {
        id: '1',
        url: 'http://a',
        namespace: 'bot:x',
        stateFilter: null,
      },
      {
        id: '2',
        url: 'http://b',
        namespace: 'bot:x',
        stateFilter: 'MENU',
      },
      {
        id: '3',
        url: 'http://c',
        namespace: 'bot:x',
        stateFilter: 'START',
      },
    ];

    it('matches all when stateFilter is null', () => {
      const matched = webhookRegistry.matchSubscribers({
        subscribers,
        state: 'MENU',
      });
      expect(matched.map((s) => s.id)).toEqual(['1', '2']);
    });

    it('matches exact state only', () => {
      const matched = webhookRegistry.matchSubscribers({
        subscribers,
        state: 'START',
      });
      expect(matched.map((s) => s.id)).toEqual(['1', '3']);
    });
  });
});
