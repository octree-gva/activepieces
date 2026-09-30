import Redis from 'ioredis';
import { webhookRegistry } from '../common/webhook-registry';

const WEBHOOK_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000] as const;
const DEFAULT_CONCURRENCY_CAP = 3;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_PAUSE_MS = 60_000;
const DELIVERED_TTL_SECONDS = 86_400;

type CircuitState = {
  failures: number;
  pausedUntil: number;
};

const inFlightBySubscriber = new Map<string, number>();
const circuitBySubscriber = new Map<string, CircuitState>();

function rewriteWebhookUrl(url: string): string {
  const rewritten = url.replace(/localhost/, '127.0.0.1');
  const internalBase = process.env['AP_STATE_STORE_WEBHOOK_INTERNAL'];
  if (!internalBase) {
    return rewritten;
  }
  try {
    const target = new URL(rewritten);
    const base = new URL(internalBase);
    target.protocol = base.protocol;
    target.host = base.host;
    return target.toString();
  } catch {
    return rewritten;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getConcurrencyCap(): number {
  const raw = process.env['AP_STATE_STORE_WEBHOOK_CONCURRENCY'];
  if (!raw) {
    return DEFAULT_CONCURRENCY_CAP;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CONCURRENCY_CAP;
  }
  return Math.min(parsed, 5);
}

function isCircuitOpen(subscriberId: string): boolean {
  const state = circuitBySubscriber.get(subscriberId);
  if (!state) {
    return false;
  }
  if (state.pausedUntil > Date.now()) {
    return true;
  }
  if (state.pausedUntil > 0 && state.pausedUntil <= Date.now()) {
    circuitBySubscriber.set(subscriberId, { failures: 0, pausedUntil: 0 });
  }
  return false;
}

function recordDeliverySuccess(subscriberId: string): void {
  circuitBySubscriber.set(subscriberId, { failures: 0, pausedUntil: 0 });
}

function isAddressUnavailable(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? error.code : undefined;
  return code === 'EADDRNOTAVAIL' || code === 'ECONNREFUSED' || code === 'ENOTFOUND';
}

function recordDeliveryFailure(subscriberId: string, error: unknown): void {
  const current = circuitBySubscriber.get(subscriberId) ?? {
    failures: 0,
    pausedUntil: 0,
  };
  const failures = current.failures + 1;
  const hardFail = isAddressUnavailable(error);
  if (hardFail || failures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitBySubscriber.set(subscriberId, {
      failures,
      pausedUntil: Date.now() + CIRCUIT_PAUSE_MS,
    });
    console.error(
      '[watcher] Circuit open for subscriber',
      subscriberId,
      'failures=',
      failures
    );
    return;
  }
  circuitBySubscriber.set(subscriberId, { failures, pausedUntil: 0 });
}

type PostAttemptResult =
  | { ok: true }
  | { ok: false; status: number; body: string }
  | { ok: false; error: unknown };

async function postWebhookOnce({
  url,
  payload,
}: {
  url: string;
  payload: string;
}): Promise<PostAttemptResult> {
  const target = rewriteWebhookUrl(url);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok) {
      return { ok: true };
    }
    const body = await res.text();
    return { ok: false, status: res.status, body: body || '(no content)' };
  } catch (error) {
    return { ok: false, error };
  }
}

function logDeliveryFailure({
  url,
  result,
}: {
  url: string;
  result: Exclude<PostAttemptResult, { ok: true }>;
}): void {
  if ('error' in result) {
    console.error('[watcher] Webhook POST failed after retries:', url, result.error);
    return;
  }
  console.error(
    '[watcher] Webhook POST failed after retries:',
    url,
    result.status,
    result.body
  );
}

async function claimDelivery({
  redis,
  subscriberId,
  streamId,
}: {
  redis: Redis;
  subscriberId: string;
  streamId: string;
}): Promise<boolean> {
  const key = webhookRegistry.getDeliveredKey({ subscriberId, streamId });
  const result = await redis.set(key, '1', 'EX', DELIVERED_TTL_SECONDS, 'NX');
  return result === 'OK';
}

async function waitForConcurrencySlot(subscriberId: string): Promise<boolean> {
  const cap = getConcurrencyCap();
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (isCircuitOpen(subscriberId)) {
      return false;
    }
    const current = inFlightBySubscriber.get(subscriberId) ?? 0;
    if (current < cap) {
      inFlightBySubscriber.set(subscriberId, current + 1);
      return true;
    }
    await sleep(50);
  }
  return false;
}

function releaseConcurrencySlot(subscriberId: string): void {
  const current = inFlightBySubscriber.get(subscriberId) ?? 0;
  if (current <= 1) {
    inFlightBySubscriber.delete(subscriberId);
    return;
  }
  inFlightBySubscriber.set(subscriberId, current - 1);
}

async function deliverWithRetries({
  redis,
  subscriberId,
  streamId,
  url,
  payload,
}: {
  redis: Redis;
  subscriberId: string;
  streamId: string;
  url: string;
  payload: string;
}): Promise<void> {
  if (isCircuitOpen(subscriberId)) {
    return;
  }

  const acquired = await waitForConcurrencySlot(subscriberId);
  if (!acquired) {
    return;
  }

  try {
    const claimed = await claimDelivery({ redis, subscriberId, streamId });
    if (!claimed) {
      return;
    }

    const firstAttempt = await postWebhookOnce({ url, payload });
    if (firstAttempt.ok) {
      recordDeliverySuccess(subscriberId);
      return;
    }
    let lastFailure: Exclude<PostAttemptResult, { ok: true }> = firstAttempt;

    for (const delayMs of WEBHOOK_RETRY_DELAYS_MS) {
      if (isCircuitOpen(subscriberId)) {
        return;
      }
      await sleep(delayMs);
      const attempt = await postWebhookOnce({ url, payload });
      if (attempt.ok) {
        recordDeliverySuccess(subscriberId);
        return;
      }
      lastFailure = attempt;
      if ('error' in attempt) {
        recordDeliveryFailure(subscriberId, attempt.error);
      } else {
        recordDeliveryFailure(subscriberId, { code: `HTTP_${attempt.status}` });
      }
    }

    logDeliveryFailure({ url, result: lastFailure });
  } finally {
    releaseConcurrencySlot(subscriberId);
  }
}

function resetDeliveryStateForTests(): void {
  inFlightBySubscriber.clear();
  circuitBySubscriber.clear();
}

export const webhookDelivery = {
  WEBHOOK_RETRY_DELAYS_MS,
  deliverWithRetries,
  rewriteWebhookUrl,
  resetDeliveryStateForTests,
  getConcurrencyCap,
  isCircuitOpen,
  recordDeliveryFailure,
  recordDeliverySuccess,
};

export type WebhookDelivery = typeof webhookDelivery;
