import Redis from 'ioredis';
import { conversationDriver } from './helpers/conversation-driver';
import { listenerClient } from './helpers/listener-client';
import { cleanupNamespace, connectE2eRedis, e2eNamespace } from './helpers/redis-e2e';
import { pollNamespacesOnce } from '../../src/lib/bridge/run-bridge';

describe('E2E B two-user interleave', () => {
  let redis: Redis;
  const namespace = e2eNamespace();

  beforeAll(async () => {
    redis = await connectE2eRedis();
    await cleanupNamespace({ redis, namespace });
    await listenerClient.reset();
  }, 60000);

  afterAll(async () => {
    await cleanupNamespace({ redis, namespace });
    await redis.quit();
  });

  it('dispatches distinct events per conversation without cross-talk', async () => {
    let snap = await listenerClient.getSnapshot();
    let before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'conv-7',
      create: true,
      data: { user_id: 7 },
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    const weba7 = snap.WEBA[snap.WEBA.length - 1]?.body as {
      conversation_id: string;
      current: { data: { user_id: number } };
    };
    expect(weba7.conversation_id).toBe('conv-7');
    expect(weba7.current.data.user_id).toBe(7);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'conv-8',
      create: true,
      data: { user_id: 8 },
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    const weba8 = snap.WEBA[snap.WEBA.length - 1]?.body as {
      conversation_id: string;
      current: { data: { user_id: number } };
    };
    expect(weba8.conversation_id).toBe('conv-8');
    expect(weba8.current.data.user_id).toBe(8);
    before = listenerClient.counts(snap);

    const webbBefore = before.WEBB;
    const webcBefore = before.WEBC;

    await Promise.all([
      conversationDriver.updateConversation({
        namespace,
        conversationId: 'conv-7',
        state: 'MENU',
        data: { user_id: 7 },
        replaceData: true,
      }),
      conversationDriver.updateConversation({
        namespace,
        conversationId: 'conv-8',
        state: 'READ_BLOG',
        data: { user_id: 8, page: 1 },
        replaceData: true,
      }),
    ]);
    await pollNamespacesOnce({ redis });
    snap = await listenerClient.getSnapshot();
    expect(snap.WEBB.length - webbBefore).toBe(1);
    expect(snap.WEBC.length - webcBefore).toBe(1);
    expect(snap.WEBA.length).toBe(before.WEBA);

    const webb = snap.WEBB[snap.WEBB.length - 1]?.body as {
      conversation_id: string;
    };
    const webc = snap.WEBC[snap.WEBC.length - 1]?.body as {
      conversation_id: string;
    };
    expect(webb.conversation_id).toBe('conv-7');
    expect(webc.conversation_id).toBe('conv-8');
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'conv-7',
      state: 'MENU',
      data: { user_id: 7, answer: 'x' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 1,
      WEBC: 0,
    });
  }, 120000);
});
