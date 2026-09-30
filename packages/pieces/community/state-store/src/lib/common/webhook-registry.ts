import { apId } from '@activepieces/pieces-framework';
import Redis from 'ioredis';
import { z } from 'zod';

const SUBSCRIBERS_KEY = 'state-store:bridge:subscribers';
const NAMESPACES_KEY = 'state-store:bridge:namespaces';

const webhookSubscriberSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  namespace: z.string().min(1),
  stateFilter: z.string().min(1),
});

export type WebhookSubscriber = z.infer<typeof webhookSubscriberSchema>;

export type SubscribeInput = {
  url: string;
  namespace: string;
  stateFilter: string;
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

function getWatchedStatesKey(namespace: string): string {
  return `state-store:bridge:watched_states:${namespace}`;
}

function getCursorKey(namespace: string): string {
  return `${namespace}:bridge:cursor`;
}

function getDeliveredKey({
  subscriberId,
  streamId,
}: {
  subscriberId: string;
  streamId: string;
}): string {
  return `state-store:bridge:delivered:${subscriberId}:${streamId}`;
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

async function rebuildWatchedStates({
  redis,
  namespace,
}: {
  redis: Redis;
  namespace: string;
}): Promise<void> {
  const key = getWatchedStatesKey(namespace);
  await redis.del(key);
  const filters = new Set(
    (await listAll({ redis }))
      .filter((subscriber) => subscriber.namespace === namespace)
      .map((subscriber) => subscriber.stateFilter)
  );
  if (filters.size === 0) {
    return;
  }
  await redis.sadd(key, ...Array.from(filters));
}

async function listWatchedStates({
  redis,
  namespace,
}: {
  redis: Redis;
  namespace: string;
}): Promise<string[]> {
  return redis.smembers(getWatchedStatesKey(namespace));
}

function wouldMatchEnterOnly({
  previousState,
  currentState,
  watchedStates,
}: {
  previousState: string | null | undefined;
  currentState: string;
  watchedStates: string[];
}): boolean {
  if (previousState === currentState) {
    return false;
  }
  return watchedStates.includes(currentState);
}

async function gcDuplicateSubscribers({
  redis,
}: {
  redis: Redis;
}): Promise<number> {
  const entries = await redis.hgetall(SUBSCRIBERS_KEY);
  const keepByKey = new Map<string, string>();
  const toDelete: string[] = [];
  const touchedNamespaces = new Set<string>();

  for (const [id, raw] of Object.entries(entries)) {
    const subscriber = parseSubscriber(raw);
    if (!subscriber) {
      toDelete.push(id);
      continue;
    }
    const key = `${subscriber.namespace}\0${subscriber.url}`;
    const existingId = keepByKey.get(key);
    if (!existingId) {
      keepByKey.set(key, id);
      continue;
    }
    toDelete.push(id);
    touchedNamespaces.add(subscriber.namespace);
  }

  for (const id of toDelete) {
    await redis.hdel(SUBSCRIBERS_KEY, id);
  }

  for (const namespace of touchedNamespaces) {
    await rebuildWatchedStates({ redis, namespace });
    const remaining = (await listAll({ redis })).some(
      (entry) => entry.namespace === namespace
    );
    if (!remaining) {
      await redis.srem(NAMESPACES_KEY, namespace);
    }
  }

  return toDelete.length;
}

async function subscribe({
  redis,
  input,
}: {
  redis: Redis;
  input: SubscribeInput;
}): Promise<WebhookSubscriber> {
  const all = await listAll({ redis });
  const duplicates = all.filter(
    (entry) => entry.namespace === input.namespace && entry.url === input.url
  );
  const existing = duplicates[0];
  for (const duplicate of duplicates.slice(1)) {
    await redis.hdel(SUBSCRIBERS_KEY, duplicate.id);
  }

  const subscriber: WebhookSubscriber = {
    id: existing?.id ?? apId(),
    url: input.url,
    namespace: input.namespace,
    stateFilter: input.stateFilter,
  };
  webhookSubscriberSchema.parse(subscriber);
  await redis.hset(SUBSCRIBERS_KEY, subscriber.id, serializeSubscriber(subscriber));
  await redis.sadd(NAMESPACES_KEY, subscriber.namespace);
  await rebuildWatchedStates({ redis, namespace: subscriber.namespace });
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
  await rebuildWatchedStates({ redis, namespace: subscriber.namespace });
  const remaining = (await listAll({ redis })).some(
    (entry) => entry.namespace === subscriber.namespace
  );
  if (!remaining) {
    await redis.srem(NAMESPACES_KEY, subscriber.namespace);
  }
}

async function unsubscribeByUrl({
  redis,
  url,
}: {
  redis: Redis;
  url: string;
}): Promise<number> {
  const matches = (await listAll({ redis })).filter((entry) => entry.url === url);
  for (const match of matches) {
    await unsubscribe({ redis, id: match.id });
  }
  return matches.length;
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
  previousState,
  currentState,
}: {
  subscribers: WebhookSubscriber[];
  previousState: string | null | undefined;
  currentState: string;
}): WebhookSubscriber[] {
  if (previousState === currentState) {
    return [];
  }
  return subscribers.filter(
    (subscriber) => subscriber.stateFilter === currentState
  );
}

export const webhookRegistry = {
  SUBSCRIBERS_KEY,
  NAMESPACES_KEY,
  serializeSubscriber,
  parseSubscriber,
  subscribe,
  unsubscribe,
  unsubscribeByUrl,
  listAll,
  listNamespaces,
  listByNamespace,
  matchSubscribers,
  getCursorKey,
  getWatchedStatesKey,
  getDeliveredKey,
  listWatchedStates,
  rebuildWatchedStates,
  wouldMatchEnterOnly,
  gcDuplicateSubscribers,
};
