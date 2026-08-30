// Brute-force protection for /api/join-game.
//
// Failed joins (invalid PIN) are counted per-IP; once the budget is spent the
// caller is blocked with 429 instead of being able to keep guessing the
// 6-digit PIN. Only FAILED joins are counted, so legitimate joins are unaffected.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network. A tiny limit (3 / 60s) is configured
// so the test can exhaust it quickly; these assignments MUST happen before
// app.ts (which runs `dotenv/config`) is imported.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.JOIN_ATTEMPT_LIMIT = '3';
process.env.JOIN_ATTEMPT_WINDOW_SECONDS = '60';

import test from 'node:test';
import assert from 'node:assert/strict';

test('SECURITY: /api/join-game blocks brute-forcing an invalid PIN after N failed attempts', async (t) => {
  const { default: app } = await import('../app.js');
  const server = app.listen(0);
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const wrongPin = '000000';

  const tryJoin = () =>
    fetch(`${base}/api/join-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'brute-force-bot', pin: wrongPin, name: 'Bot' }),
    }).then(async (res) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> }));

  // The first N failed attempts are allowed (they just report "not found").
  for (let i = 0; i < 3; i++) {
    const res = await tryJoin();
    assert.equal(res.status, 200, `attempt ${i} must be allowed`);
    assert.equal((res.body as { success: boolean }).success, false);
  }

  // The next failed attempt is rate-limited with HTTP 429.
  const blocked = await tryJoin();
  assert.equal(blocked.status, 429, 'over-limit brute-force attempt must get HTTP 429');
  assert.equal((blocked.body as { success: boolean }).success, false);
  assert.ok((blocked.body as { retryAfterMs?: number }).retryAfterMs > 0);
});

test('SECURITY: valid joins are NOT blocked by the brute-force limiter', async (t) => {
  const { default: app } = await import('../app.js');
  const store = await import('../src/server/state.js');
  const server = app.listen(0);
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  // Register a teacher + their game.
  const created = await fetch(`${base}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'rl-teacher' }),
  });
  const createdBody = (await created.json()) as { success: boolean; pin?: string };
  assert.equal(createdBody.success, true);
  const pin = createdBody.pin as string;

  // A successful join with the correct PIN must NOT count as a failure and must
  // succeed even though the (shared local) brute-force budget is small.
  const join = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'rl-student', pin, name: 'Ali' }),
  });
  assert.equal(join.status, 200);
  const joinBody = (await join.json()) as { success: boolean };
  assert.equal(joinBody.success, true);

  const game = await store.getGame(pin);
  assert.ok(game?.students['rl-student']);
});
