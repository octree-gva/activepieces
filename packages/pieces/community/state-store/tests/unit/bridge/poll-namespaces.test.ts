import Redis from 'ioredis';
import { pollNamespacesOnce } from '../../../src/lib/bridge/run-bridge';
import { webhookRegistry } from '../../../src/lib/common/webhook-registry';

type MockStore = {
  sets: Record<string, Set<string>>;
  strings: Record<string, string>;
  xreadResult: [string, [string, string[]][]][] | null;
};

function createMockRedis(store: MockStore): Redis {
  return {
    smembers: jest.fn(async (key: string) => Array.from(store.sets[key] ?? [])),
    get: jest.fn(async (key: string) => store.strings[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.strings[key] = value;
      return 'OK';
    }),
    hgetall: jest.fn(async () => ({})),
    xread: jest.fn(async () => store.xreadResult),
  } as unknown as Redis;
}

describe('pollNamespacesOnce namespace mapping', () => {
  it('advances cursor for the stream key namespace when XREAD returns a subset', async () => {
    const store: MockStore = {
      sets: {
        'state-store:bridge:namespaces': new Set(['chatbot:voca', 'chat:chatbo']),
      },
      strings: {
        [webhookRegistry.getCursorKey('chatbot:voca')]: '1-0',
        [webhookRegistry.getCursorKey('chat:chatbo')]: '10-0',
      },
      xreadResult: [
        [
          'chat:chatbo:events',
          [
            [
              '11-0',
              [
                'payload',
                JSON.stringify({
                  conversation_id: 'user-1',
                  previous: { state: 'WELCOME', data: {} },
                  current: { state: 'MENU', data: { user_id: 1 } },
                }),
              ],
            ],
          ],
        ],
      ],
    };
    const redis = createMockRedis(store);

    await pollNamespacesOnce({ redis });

    expect(store.strings[webhookRegistry.getCursorKey('chat:chatbo')]).toBe('11-0');
    expect(store.strings[webhookRegistry.getCursorKey('chatbot:voca')]).toBe('1-0');
  });
});
