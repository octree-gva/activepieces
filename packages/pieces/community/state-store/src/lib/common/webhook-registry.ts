import { apId } from '@activepieces/pieces-framework';
import Redis from 'ioredis';
import { z } from 'zod';

const SUBSCRIBERS_KEY = 'state-store:bridge:subscribers';
const NAMESPACES_KEY = 'state-store:bridge:namespaces';

const webhookSubscriberSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  namespace: z.string().min(1),
  stateFilter: z.string().nullable(),
});

export type WebhookSubscriber = z.infer<typeof webhookSubscriberSchema>;

export type SubscribeInput = {
  url: string;
  namespace: string;
  stateFilter: string | null;
};

function serializeSubscriber(subscriber: WebhookSubscriber): string {
  return JSON.stringify(subscriber);
}

function parseSubscriber(raw: string): WebhookSubscriber | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = webhookSubscriberSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

async function listAll({ redis }: { redis: Redis }): Promise<WebhookSubscriber[]> {
  const entries = await redis.hgetall(SUBSCRIBERS_KEY);
  const subscribers: WebhookSubscriber[] = [];
  for (const raw of Object.values(entries)) {
    const subscriber = parseSubscriber(raw);
    if (subscriber) {
      subscribers.push(subscriber);
    }
  }
  return subscribers;
}

async function subscribe({
  redis,
  input,
}: {
  redis: Redis;
  input: SubscribeInput;
}): Promise<WebhookSubscriber> {
  const subscriber: WebhookSubscriber = {
    id: apId(),
    url: input.url,
    namespace: input.namespace,
    stateFilter: input.stateFilter,
  };
  webhookSubscriberSchema.parse(subscriber);
  await redis.hset(SUBSCRIBERS_KEY, subscriber.id, serializeSubscriber(subscriber));
  await redis.sadd(NAMESPACES_KEY, subscriber.namespace);
  return subscriber;
}

async function unsubscribe({ redis, id }: { redis: Redis; id: string }): Promise<void> {
  const raw = await redis.hget(SUBSCRIBERS_KEY, id);
  if (!raw) {
    return;
  }
  const subscriber = parseSubscriber(raw);
  await redis.hdel(SUBSCRIBERS_KEY, id);
  if (!subscriber) {
    return;
  }
  const remaining = (await listAll({ redis })).some(
    (entry) => entry.namespace === subscriber.namespace
  );
  if (!remaining) {
    await redis.srem(NAMESPACES_KEY, subscriber.namespace);
  }
}

async function listNamespaces({ redis }: { redis: Redis }): Promise<string[]> {
  return redis.smembers(NAMESPACES_KEY);
}

async function listByNamespace({
  redis,
  namespace,
}: {
  redis: Redis;
  namespace: string;
}): Promise<WebhookSubscriber[]> {
  const all = await listAll({ redis });
  return all.filter((subscriber) => subscriber.namespace === namespace);
}

function matchSubscribers({
  subscribers,
  state,
}: {
  subscribers: WebhookSubscriber[];
  state: string;
}): WebhookSubscriber[] {
  return subscribers.filter(
    (subscriber) =>
      subscriber.stateFilter === null || subscriber.stateFilter === state
  );
}

function getCursorKey(namespace: string): string {
  return `${namespace}:bridge:cursor`;
}

export const webhookRegistry = {
  SUBSCRIBERS_KEY,
  NAMESPACES_KEY,
  serializeSubscriber,
  parseSubscriber,
  subscribe,
  unsubscribe,
  listNamespaces,
  listByNamespace,
  matchSubscribers,
  getCursorKey,
};
