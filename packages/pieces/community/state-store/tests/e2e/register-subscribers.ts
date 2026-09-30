#!/usr/bin/env npx ts-node

const bridgeUrl = (process.env['AP_STATE_STORE_BRIDGE_URL'] ?? 'http://127.0.0.1:3847').replace(
  /\/$/,
  ''
);
const listenerUrl = (
  process.env['E2E_WEBHOOK_LISTENER_URL'] ?? 'http://127.0.0.1:8090'
).replace(/\/$/, '');
const namespace = process.env['E2E_NAMESPACE'] ?? 'e2e:compose';

const subscribers = [
  { path: '/WEBA', stateFilter: 'WELCOME' },
  { path: '/WEBB', stateFilter: 'MENU' },
  { path: '/WEBC', stateFilter: 'READ_BLOG' },
] as const;

async function waitHealthy(url: string, label: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log(`[register] ${label} healthy`);
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} not healthy at ${url}`);
}

async function main(): Promise<void> {
  await waitHealthy(bridgeUrl, 'bridge');
  await waitHealthy(listenerUrl, 'listener');

  for (const subscriber of subscribers) {
    const response = await fetch(`${bridgeUrl}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${listenerUrl}${subscriber.path}`,
        namespace,
        stateFilter: subscriber.stateFilter,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`subscribe ${subscriber.path} failed: ${response.status} ${text}`);
    }
    const body = (await response.json()) as { id: string };
    console.log(`[register] ${subscriber.path} → ${subscriber.stateFilter} id=${body.id}`);
  }
}

main().catch((err) => {
  console.error('[register] Fatal:', err);
  process.exit(1);
});
