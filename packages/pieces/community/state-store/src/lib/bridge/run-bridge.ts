import http from 'http';
import Redis from 'ioredis';
import { z } from 'zod';
import { webhookDelivery } from './webhook-delivery';
import { getBridgePort } from '../common/bridge-url';
import { webhookRegistry, WebhookSubscriber } from '../common/webhook-registry';
import { getEventsKey, parseConversationEvent } from '../utils/validation';

const subscribeBodySchema = z.object({
  url: z.string().min(1),
  namespace: z.string().min(1),
  stateFilter: z.string().min(1),
});

const ORPHAN_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

export type RunBridgeParams = {
  redisUrl: string;
  listenPort?: number;
};

export type StartBridgeHttpServerParams = {
  redis: Redis;
  listenPort?: number;
};

export type StartBridgeHttpServerResult = {
  port: number;
  close: () => Promise<void>;
};

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function dispatchPayload({
  redis,
  namespace,
  streamId,
  payload,
}: {
  redis: Redis;
  namespace: string;
  streamId: string;
  payload: string;
}): Promise<void> {
  const event = parseConversationEvent(payload);
  if (!event) {
    return;
  }
  const subscribers = await webhookRegistry.listByNamespace({ redis, namespace });
  const matched = webhookRegistry.matchSubscribers({
    subscribers,
    currentState: event.current.state,
  });
  await Promise.all(
    matched.map((subscriber) =>
      webhookDelivery.deliverWithRetries({
        redis,
        subscriberId: subscriber.id,
        streamId,
        url: subscriber.url,
        payload,
      })
    )
  );
}

async function processStreamEntries({
  redis,
  namespace,
  entries,
}: {
  redis: Redis;
  namespace: string;
  entries: [string, string[]][];
}): Promise<string | null> {
  const cursorKey = webhookRegistry.getCursorKey(namespace);
  let lastId: string | null = null;
  for (const [id, fields] of entries) {
    lastId = id;
    const payloadIdx = fields.findIndex((field) => field === 'payload');
    if (payloadIdx === -1) {
      continue;
    }
    const payload = fields[payloadIdx + 1];
    if (typeof payload !== 'string') {
      continue;
    }
    await dispatchPayload({ redis, namespace, streamId: id, payload });
  }
  if (lastId) {
    await redis.set(cursorKey, lastId);
  }
  return lastId;
}

async function pollNamespaces({
  redis,
  blockMs,
  defaultStartId,
}: {
  redis: Redis;
  blockMs: number;
  defaultStartId: string;
}): Promise<void> {
  const namespaces = await webhookRegistry.listNamespaces({ redis });
  if (namespaces.length === 0) {
    return;
  }
  const streamKeys = namespaces.map((namespace) => getEventsKey(namespace));
  const cursors = await Promise.all(
    namespaces.map((namespace) =>
      redis.get(webhookRegistry.getCursorKey(namespace))
    )
  );
  const startIds = cursors.map((cursor) => cursor ?? defaultStartId);
  const result =
    blockMs > 0
      ? await redis.xread('BLOCK', blockMs, 'STREAMS', ...streamKeys, ...startIds)
      : await redis.xread('COUNT', 100, 'STREAMS', ...streamKeys, ...startIds);
  if (!result) {
    return;
  }
  for (let index = 0; index < result.length; index += 1) {
    const [, entries] = result[index];
    await processStreamEntries({
      redis,
      namespace: namespaces[index],
      entries,
    });
  }
}

export async function pollNamespacesOnce({
  redis,
}: {
  redis: Redis;
}): Promise<void> {
  await pollNamespaces({
    redis,
    blockMs: 0,
    defaultStartId: '0-0',
  });
}

async function probeSubscriberUrl(url: string): Promise<number | null> {
  const rewritten = webhookDelivery.rewriteWebhookUrl(url);
  try {
    const response = await fetch(rewritten, { method: 'GET' });
    return response.status;
  } catch {
    return null;
  }
}

async function dropOrphanSubscribers({ redis }: { redis: Redis }): Promise<number> {
  const subscribers = await webhookRegistry.listAll({ redis });
  let removed = 0;
  for (const subscriber of subscribers) {
    const status = await probeSubscriberUrl(subscriber.url);
    if (status === 404) {
      await webhookRegistry.unsubscribe({ redis, id: subscriber.id });
      removed += 1;
    }
  }
  return removed;
}

function createRequestHandler(redis: Redis) {
  return async (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/subscribers') {
      try {
        const raw = await readBody(request);
        const body = subscribeBodySchema.parse(JSON.parse(raw));
        const subscriber = await webhookRegistry.subscribe({
          redis,
          input: {
            url: body.url,
            namespace: body.namespace,
            stateFilter: body.stateFilter,
          },
        });
        sendJson(response, 201, { id: subscriber.id });
      } catch (err) {
        console.error('[watcher] POST /subscribers failed:', err);
        sendJson(response, 400, { error: 'Invalid subscribe request' });
      }
      return;
    }
    if (request.method === 'DELETE' && url.pathname === '/subscribers') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl || targetUrl.trim() === '') {
        sendJson(response, 400, { error: 'url query parameter required' });
        return;
      }
      const removed = await webhookRegistry.unsubscribeByUrl({
        redis,
        url: targetUrl,
      });
      sendJson(response, 200, { ok: true, removed });
      return;
    }
    const deleteMatch = url.pathname.match(/^\/subscribers\/([^/]+)$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const id = decodeURIComponent(deleteMatch[1]);
      await webhookRegistry.unsubscribe({ redis, id });
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  };
}

export async function startBridgeHttpServer({
  redis,
  listenPort,
}: StartBridgeHttpServerParams): Promise<StartBridgeHttpServerResult> {
  const port = listenPort ?? getBridgePort();
  const server = http.createServer((request, response) => {
    createRequestHandler(redis)(request, response).catch((err) => {
      console.error('[watcher] Request error:', err);
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'Internal error' });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      console.log('[watcher] Listening on', port);
      resolve();
    });
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}

export async function runBridge({ redisUrl, listenPort }: RunBridgeParams): Promise<void> {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  redis.on('error', (err) => console.error('[watcher] Redis error:', err));
  await redis.ping();
  console.log('[watcher] Redis connected');

  const duplicatesRemoved = await webhookRegistry.gcDuplicateSubscribers({ redis });
  if (duplicatesRemoved > 0) {
    console.log('[watcher] Removed duplicate subscribers:', duplicatesRemoved);
  }
  const orphansRemoved = await dropOrphanSubscribers({ redis });
  if (orphansRemoved > 0) {
    console.log('[watcher] Removed orphan subscribers:', orphansRemoved);
  }

  await startBridgeHttpServer({ redis, listenPort });

  setInterval(() => {
    void dropOrphanSubscribers({ redis })
      .then((removed) => {
        if (removed > 0) {
          console.log('[watcher] Periodic orphan cleanup removed:', removed);
        }
      })
      .catch((err) => console.error('[watcher] Orphan cleanup failed:', err));
  }, ORPHAN_RECONCILE_INTERVAL_MS);

  while (true) {
    try {
      await pollNamespaces({
        redis,
        blockMs: 1000,
        defaultStartId: '$',
      });
    } catch (err) {
      console.error('[watcher] Poll error:', err);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export type { WebhookSubscriber };
