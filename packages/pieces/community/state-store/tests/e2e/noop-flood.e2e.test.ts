import Redis from 'ioredis';
import { conversationDriver } from './helpers/conversation-driver';
import { listenerClient } from './helpers/listener-client';
import { cleanupNamespace, connectE2eRedis, e2eNamespace } from './helpers/redis-e2e';
import { pollNamespacesOnce } from '../../src/lib/bridge/run-bridge';

describe('E2E D noop flood', () => {
  let redis: Redis;
  const namespace = e2eNamespace();
  const CONV = 'flood-user-2';
  const PAYLOAD = { user_id: 2, answer: '' };

  beforeAll(async () => {
    redis = await connectE2eRedis();
    await cleanupNamespace({ redis, namespace });
    await listenerClient.reset();
    await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      create: true,
      data: PAYLOAD,
    });
  }, 60000);

  afterAll(async () => {
    await cleanupNamespace({ redis, namespace });
    await redis.quit();
  });

  it('D1 sequential ×1000 identical updates dispatch nothing', async () => {
    const before = listenerClient.counts(await listenerClient.getSnapshot());
    for (let i = 0; i < 1000; i += 1) {
      await conversationDriver.updateConversation({
        namespace,
        conversationId: CONV,
        state: 'WELCOME',
        data: PAYLOAD,
        replaceData: true,
      });
    }
    await pollNamespacesOnce({ redis });
    const after = await listenerClient.getSnapshot();
    expect(conversationDriver.delta(before, after)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 0,
    });
  }, 180000);

  it('D2 concurrent ×1000 identical updates stay bounded', async () => {
    const before = listenerClient.counts(await listenerClient.getSnapshot());
    await Promise.all(
      Array.from({ length: 1000 }, () =>
        conversationDriver.updateConversation({
          namespace,
          conversationId: CONV,
          state: 'WELCOME',
          data: PAYLOAD,
          replaceData: true,
        })
      )
    );
    await pollNamespacesOnce({ redis });
    const after = await listenerClient.getSnapshot();
    const d = conversationDriver.delta(before, after);
    expect(d.WEBB).toBe(0);
    expect(d.WEBC).toBe(0);
    expect(d.WEBA).toBeLessThanOrEqual(5);
  }, 180000);

  it('D3 concurrent no-ops plus one real change wake WEBA once-ish', async () => {
    const before = listenerClient.counts(await listenerClient.getSnapshot());
    const jobs = Array.from({ length: 1000 }, () =>
      conversationDriver.updateConversation({
        namespace,
        conversationId: CONV,
        state: 'WELCOME',
        data: PAYLOAD,
        replaceData: true,
      })
    );
    jobs.push(
      conversationDriver.updateConversation({
        namespace,
        conversationId: CONV,
        state: 'WELCOME',
        data: { user_id: 2, answer: 'ping' },
        replaceData: true,
      })
    );
    await Promise.all(jobs);
    await pollNamespacesOnce({ redis });
    const after = await listenerClient.getSnapshot();
    const d = conversationDriver.delta(before, after);
    expect(d.WEBB).toBe(0);
    expect(d.WEBC).toBe(0);
    expect(d.WEBA).toBeGreaterThanOrEqual(1);
    expect(d.WEBA).toBeLessThan(1000);
    const ping = after.WEBA.some((post) => {
      const body = post.body as { current?: { data?: { answer?: string } } };
      return body.current?.data?.answer === 'ping';
    });
    expect(ping).toBe(true);
  }, 180000);
});
