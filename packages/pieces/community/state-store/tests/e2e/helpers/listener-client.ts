export type ListenerChannel = 'WEBA' | 'WEBB' | 'WEBC';

export type StoredPost = {
  at: string;
  body: unknown;
};

export type ListenerSnapshot = Record<ListenerChannel, StoredPost[]>;

function listenerBaseUrl(): string {
  const url = process.env['E2E_WEBHOOK_LISTENER_URL'];
  if (!url) {
    throw new Error('E2E_WEBHOOK_LISTENER_URL is required');
  }
  return url.replace(/\/$/, '');
}

async function getSnapshot(): Promise<ListenerSnapshot> {
  const response = await fetch(`${listenerBaseUrl()}/snapshot`);
  if (!response.ok) {
    throw new Error(`snapshot failed: ${response.status}`);
  }
  return (await response.json()) as ListenerSnapshot;
}

async function reset(): Promise<void> {
  const response = await fetch(`${listenerBaseUrl()}/reset`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`reset failed: ${response.status}`);
  }
}

function counts(snapshot: ListenerSnapshot): Record<ListenerChannel, number> {
  return {
    WEBA: snapshot.WEBA.length,
    WEBB: snapshot.WEBB.length,
    WEBC: snapshot.WEBC.length,
  };
}

export const listenerClient = {
  getSnapshot,
  reset,
  counts,
  baseUrl: listenerBaseUrl,
};
