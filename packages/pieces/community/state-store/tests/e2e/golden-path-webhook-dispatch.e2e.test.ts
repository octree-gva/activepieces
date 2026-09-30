import Redis from 'ioredis';
import { conversationDriver } from './helpers/conversation-driver';
import { listenerClient } from './helpers/listener-client';
import { cleanupNamespace, connectE2eRedis, e2eNamespace } from './helpers/redis-e2e';

const CONV = 'user-2';

describe('E2E A golden path WEBA/WEBB/WEBC', () => {
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

  it('runs the 10-step golden path', async () => {
    let snap = await listenerClient.getSnapshot();
    let before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      create: true,
      data: { user_id: 2, answer: '' },
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 1,
      WEBB: 0,
      WEBC: 0,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'WELCOME',
      data: { user_id: 2, answer: '' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 0,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'MENU',
      data: { user_id: 2, answer: '' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 1,
      WEBC: 0,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'MENU',
      data: { user_id: 2, answer: 'read_blogs:2:1' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 1,
      WEBC: 0,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'READ_BLOG',
      data: { user_id: 2, menu_id: 7, answer: '' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 1,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'READ_BLOG',
      data: { user_id: 2, menu_id: 7, answer: 'next', page: 1 },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 1,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'READ_BLOG',
      data: { user_id: 2, menu_id: 7, page: 2, answer: '' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 1,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'READ_BLOG',
      data: { user_id: 2, menu_id: 7, page: 2, answer: 'menu' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 0,
      WEBC: 1,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'MENU',
      data: { user_id: 2, menu_id: '', page: '', answer: '' },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 0,
      WEBB: 1,
      WEBC: 0,
    });
    before = listenerClient.counts(snap);

    snap = await conversationDriver.mutateAndPoll({
      redis,
      namespace,
      conversationId: CONV,
      state: 'WELCOME',
      data: { user_id: 2 },
      replaceData: true,
    });
    expect(conversationDriver.delta(before, snap)).toEqual({
      WEBA: 1,
      WEBB: 0,
      WEBC: 0,
    });
  }, 120000);
});
