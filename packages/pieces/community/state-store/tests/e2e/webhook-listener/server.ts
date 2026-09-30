#!/usr/bin/env npx ts-node
import http from 'http';

type StoredPost = {
  at: string;
  body: unknown;
};

type Snapshot = {
  WEBA: StoredPost[];
  WEBB: StoredPost[];
  WEBC: StoredPost[];
};

const posts: Snapshot = {
  WEBA: [],
  WEBB: [],
  WEBC: [],
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

function channelFromPath(pathname: string): keyof Snapshot | null {
  if (pathname === '/WEBA') return 'WEBA';
  if (pathname === '/WEBB') return 'WEBB';
  if (pathname === '/WEBC') return 'WEBC';
  return null;
}

const port = Number.parseInt(process.env['E2E_WEBHOOK_LISTENER_PORT'] ?? '8090', 10);

const server = http.createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/snapshot') {
      sendJson(response, 200, posts);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/reset') {
      posts.WEBA = [];
      posts.WEBB = [];
      posts.WEBC = [];
      sendJson(response, 200, { ok: true });
      return;
    }
    const channel = channelFromPath(url.pathname);
    if (request.method === 'POST' && channel) {
      const raw = await readBody(request);
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
      posts[channel].push({
        at: new Date().toISOString(),
        body,
      });
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  })().catch((err) => {
    console.error('[e2e-listener]', err);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Internal error' });
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log('[e2e-listener] Listening on', port);
});
