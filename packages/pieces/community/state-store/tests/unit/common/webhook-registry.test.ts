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
    sadd: jest.fn(async (key: string, ...members: string[]) => {
      if (!store.sets[key]) {
        store.sets[key] = new Set();
      }
      let added = 0;
      for (const member of members) {
        const before = store.sets[key].size;
        store.sets[key].add(member);
        if (store.sets[key].size > before) {
          added += 1;
        }
      }
      return added;
    }),
    srem: jest.fn(async (key: string, member: string) => {
      if (!store.sets[key]?.has(member)) {
        return 0;
      }
      store.sets[key].delete(member);
      return 1;
    }),
    smembers: jest.fn(async (key: string) => Array.from(store.sets[key] ?? [])),
    del: jest.fn(async (key: string) => {
      const had =
        store.hash[key] != null || store.sets[key] != null || store.strings[key] != null;
      delete store.hash[key];
      delete store.sets[key];
      delete store.strings[key];
      return had ? 1 : 0;
    }),
    get: jest.fn(async (key: string) => store.strings[key] ?? null),
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && store.strings[key] != null) {
        return null;
      }
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

    it('rejects null stateFilter', () => {
      expect(
        webhookRegistry.parseSubscriber(
          JSON.stringify({
            id: 'sub-1',
            url: 'http://localhost/webhook',
            namespace: 'bot:test',
            stateFilter: null,
          })
        )
      ).toBeNull();
    });

    it('rejects garbage shape', () => {
      expect(webhookRegistry.parseSubscriber(JSON.stringify({ foo: 'bar' }))).toBeNull();
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('writes subscriber, namespace set, and watched states', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      const subscriber = await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'MENU',
        },
      });
      expect(subscriber.id).toBeTruthy();
      expect(store.hash[webhookRegistry.SUBSCRIBERS_KEY][subscriber.id]).toBeTruthy();
      expect(store.sets[webhookRegistry.NAMESPACES_KEY]?.has('bot:a')).toBe(true);
      expect(
        store.sets[webhookRegistry.getWatchedStatesKey('bot:a')]?.has('MENU')
      ).toBe(true);
    });

    it('upserts by namespace and url without stacking ids', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      const first = await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'MENU',
        },
      });
      const second = await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'START',
        },
      });
      expect(second.id).toBe(first.id);
      expect(Object.keys(store.hash[webhookRegistry.SUBSCRIBERS_KEY])).toHaveLength(1);
      expect(
        store.sets[webhookRegistry.getWatchedStatesKey('bot:a')]?.has('START')
      ).toBe(true);
      expect(
        store.sets[webhookRegistry.getWatchedStatesKey('bot:a')]?.has('MENU')
      ).toBe(false);
    });

    it('gcDuplicateSubscribers removes stacked entries', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      store.hash[webhookRegistry.SUBSCRIBERS_KEY] = {
        a: webhookRegistry.serializeSubscriber({
          id: 'a',
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'MENU',
        }),
        b: webhookRegistry.serializeSubscriber({
          id: 'b',
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'MENU',
        }),
      };
      const removed = await webhookRegistry.gcDuplicateSubscribers({ redis });
      expect(removed).toBe(1);
      expect(Object.keys(store.hash[webhookRegistry.SUBSCRIBERS_KEY])).toHaveLength(1);
    });

    it('unsubscribeByUrl removes all matching urls', async () => {
      const store: MockStore = { hash: {}, sets: {}, strings: {} };
      const redis = createMockRedis(store);
      await webhookRegistry.subscribe({
        redis,
        input: {
          url: 'http://localhost/hook',
          namespace: 'bot:a',
          stateFilter: 'MENU',
        },
      });
      const removed = await webhookRegistry.unsubscribeByUrl({
        redis,
        url: 'http://localhost/hook',
      });
      expect(removed).toBe(1);
      expect(store.hash[webhookRegistry.SUBSCRIBERS_KEY] ?? {}).toEqual({});
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

    it('matches enter into filter only', () => {
      const matched = webhookRegistry.matchSubscribers({
        subscribers,
        previousState: 'START',
        currentState: 'MENU',
      });
      expect(matched.map((s) => s.id)).toEqual(['2']);
    });

    it('does not match same-state data merges', () => {
      const matched = webhookRegistry.matchSubscribers({
        subscribers,
        previousState: 'MENU',
        currentState: 'MENU',
      });
      expect(matched).toEqual([]);
    });
  });

  describe('wouldMatchEnterOnly', () => {
    it('returns false for same-state updates', () => {
      expect(
        webhookRegistry.wouldMatchEnterOnly({
          previousState: 'MENU',
          currentState: 'MENU',
          watchedStates: ['MENU'],
        })
      ).toBe(false);
    });

    it('returns true when entering a watched state', () => {
      expect(
        webhookRegistry.wouldMatchEnterOnly({
          previousState: 'START',
          currentState: 'MENU',
          watchedStates: ['MENU'],
        })
      ).toBe(true);
    });

    it('returns false when entering an unwatched state', () => {
      expect(
        webhookRegistry.wouldMatchEnterOnly({
          previousState: 'START',
          currentState: 'MENU',
          watchedStates: ['OTHER'],
        })
      ).toBe(false);
    });
  });
});
