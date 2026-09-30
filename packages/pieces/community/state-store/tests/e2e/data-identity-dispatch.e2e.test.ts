import Redis from 'ioredis';
import { conversationDriver } from './helpers/conversation-driver';
import { listenerClient } from './helpers/listener-client';
import { cleanupNamespace, connectE2eRedis, e2eNamespace } from './helpers/redis-e2e';

describe('E2E C data identity', () => {
  let redis: Redis;
  const namespace = e2eNamespace();

  beforeAll(async () => {
    redis = await connectE2eRedis();
  }, 60000);

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await cleanupNamespace({ redis, namespace });
    await listenerClient.reset();
  });

  it('C1 numeric user_id 7 → 8 are distinct dispatches', async () => {
    let snap = await listenerClient.getSnapshot();
    let before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-num',
      create: true,
      data: { user_id: 7 },
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-num',
      state: 'WELCOME',
      data: { user_id: 8 },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-num',
      state: 'WELCOME',
      data: { user_id: 8 },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(0);
  }, 60000);

  it('C2 string user_id "7" → "8" are distinct dispatches', async () => {
    let snap = await listenerClient.getSnapshot();
    let before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-str',
      create: true,
      data: { user_id: '7' },
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-str',
      state: 'WELCOME',
      data: { user_id: '8' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-str',
      state: 'WELCOME',
      data: { user_id: '8' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(0);
  }, 60000);

  it('C3 number 7 → string "7" dispatches', async () => {
    let snap = await listenerClient.getSnapshot();
    let before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-type',
      create: true,
      data: { user_id: 7 },
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: 'id-type',
      state: 'WELCOME',
      data: { user_id: '7' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap).WEBA).toBe(1);
  }, 60000);
});
