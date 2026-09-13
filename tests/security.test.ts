// Content-Security-Policy verification.
//
// The strict CSP (script-src 'self', no inline scripts) is only applied in
// production: the Vite dev server injects an inline Fast-Refresh preamble into
// index.html, which `script-src 'self'` would block (breaking HMR), and the e2e
// suite runs against the dev server.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network. The production app instance is loaded
// via a cache-busting query import so helmet() picks up NODE_ENV=production at
// module-eval time.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';

import test from 'node:test';
import assert from 'node:assert/strict';

interface ServerCtx {
  base: string;
  close: () => void;
}

async function startServer(app: unknown): Promise<ServerCtx> {
  const listener = (app as { default?: unknown }).default ?? app;
  const server = (listener as { listen: (port: number) => unknown }).listen(0);
  await new Promise<void>((resolve) => (server as { once: (e: string, cb: () => void) => void }).once('listening', resolve));
  const address = (server as { address: () => unknown }).address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${(address as { port: number }).port}`;
  const close = () => {
    (server as { closeAllConnections: () => void }).closeAllConnections();
    (server as { close: () => void }).close();
  };
  return { base, close };
}

test('CSP: no Content-Security-Policy in dev/test (Vite inline preamble)', async (t) => {
  const { default: app } = await import('../app.js');
  const { base, close } = await startServer(app);
  t.after(close);
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.headers.get('content-security-policy'), null);
});

test('CSP: production enforces script-src self without unsafe-inline', async (t) => {
  // Cache-busting query: a NEW module instance is evaluated below, so the
  // `NODE_ENV === 'production'` gate in app.ts runs with production set.
  process.env.NODE_ENV = 'production';
  try {
    const { default: app } = await import('../app.js?prod-csp');
    const { base, close } = await startServer(app);
    t.after(close);
    const res = await fetch(`${base}/api/health`);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'expected a CSP header in production');

    // script-src must be strictly 'self' — no inline scripts allowed.
    const scriptSrc = csp.match(/script-src ([^;]+)/)?.[1] ?? '';
    assert.ok(scriptSrc.includes("'self'"), `expected 'self' in script-src: ${scriptSrc}`);
    assert.ok(!scriptSrc.includes('unsafe-inline'), `no unsafe-inline allowed in script-src: ${scriptSrc}`);

    // style-src may keep 'unsafe-inline' (runtime inline style attributes).
    const styleSrc = csp.match(/style-src ([^;]+)/)?.[1] ?? '';
    assert.ok(styleSrc.includes('unsafe-inline'), `expected style-src 'unsafe-inline': ${styleSrc}`);

    // Pusher endpoints must be connectable.
    assert.ok(csp.includes('wss://ws-ap2.pusher.com'), 'expected Pusher websocket in connect-src');

    // Object embedding must be denied entirely.
    assert.ok(/object-src 'none'/.test(csp), 'expected object-src none');
  } finally {
    process.env.NODE_ENV = 'test';
  }
});