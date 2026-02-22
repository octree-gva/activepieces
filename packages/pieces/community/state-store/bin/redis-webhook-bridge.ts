#!/usr/bin/env npx ts-node
/**
 * Bridge: subscribes to Redis Stream (XREAD BLOCK) and POSTs each event to the webhook URL.
 * Run alongside Activepieces for real-time conversation-changed triggers.
 *
 * Usage:
 *   npx ts-node scripts/redis-webhook-bridge.ts \
 *     --webhook-url "https://..." \
 *     --redis-url "redis://:pw@localhost:6379" \
 *     --namespace "bot:proposal"
 */

import Redis from 'ioredis';
function parseArgs(): { webhookUrl: string; redisUrl: string; namespace: string } {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const i = args.indexOf(key);
    if (i === -1 || !args[i + 1]) throw new Error(`Missing ${key}`);
    return args[i + 1];
  };
  return {
    webhookUrl: get('--webhook-url'),
    redisUrl: get('--redis-url'),
    namespace: get('--namespace'),
  };
}

function getEventsKey(namespace: string): string {
  return `${namespace}:events`;
}

async function main() {
  const { webhookUrl, redisUrl, namespace } = parseArgs();
  const url = webhookUrl.replace(/localhost/, '127.0.0.1');
  const eventsKey = getEventsKey(namespace);

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

  redis.on('error', (err) => console.error('[bridge] Redis error:', err));
  redis.on('connect', () => console.log('[bridge] Connected to Redis, listening on', eventsKey));

  await redis.ping();
  console.log('[bridge] Redis auth OK');

  let lastId = '$'; // Only new messages

  while (true) {
    try {
      const result = await redis.xread('BLOCK', 5000, 'STREAMS', eventsKey, lastId);
      if (!result) continue;

      for (const [, entries] of result) {
        for (const [id, fields] of entries) {
          lastId = id;
          const payloadIdx = fields.findIndex((f) => f === 'payload');
          if (payloadIdx === -1) continue;
          const payload = fields[payloadIdx + 1] as string;
          console.log('[bridge] Received event', payload);
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
            });
            const body = await res.text();
            if (res.ok) {
              console.log('[bridge] Posted event', id, body || '(no content)');
            } else {
              console.error('[bridge] Webhook POST failed:', res.status, body || '(no content)');
            }

          } catch (err) {
            console.error('[bridge] Fetch error:', err);
          }
        }
      }
    } catch (err) {
      console.error('[bridge] XREAD error:', err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

main();
