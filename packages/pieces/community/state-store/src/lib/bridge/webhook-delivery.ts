const WEBHOOK_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  const target = url.replace(/localhost/, '127.0.0.1');
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

async function deliverWithRetries({
  url,
  payload,
}: {
  url: string;
  payload: string;
}): Promise<void> {
  const firstAttempt = await postWebhookOnce({ url, payload });
  if (firstAttempt.ok) {
    return;
  }
  let lastFailure: Exclude<PostAttemptResult, { ok: true }> = firstAttempt;

  for (const delayMs of WEBHOOK_RETRY_DELAYS_MS) {
    await sleep(delayMs);
    const attempt = await postWebhookOnce({ url, payload });
    if (attempt.ok) {
      return;
    }
    lastFailure = attempt;
  }

  logDeliveryFailure({ url, result: lastFailure });
}

export const webhookDelivery = {
  WEBHOOK_RETRY_DELAYS_MS,
  deliverWithRetries,
};

export type WebhookDelivery = typeof webhookDelivery;
