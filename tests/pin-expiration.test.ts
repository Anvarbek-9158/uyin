// PIN expiration (SEC).
//
// Every game PIN has a hard lifetime (PIN_LIFETIME_MS, default 2h). Once the
// game's pinExpiresAt timestamp passes, the PIN is treated exactly like "no
// such game": joins are rejected and the failure counts against the brute-force
// budget. A live/recently-created game joins normally.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.PIN_LIFETIME_HOURS = '2';

import test from 'node:test';
import assert from 'node:assert/strict';

test('SECURITY: an expired PIN is rejected like an unknown game', async (t) => {
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
    body: JSON.stringify({ clientId: 'pin-exp-teacher' }),
  });
  const createdBody = (await created.json()) as { success: boolean; pin?: string };
  assert.equal(createdBody.success, true);
  const pin = createdBody.pin as string;

  // A fresh game carries a non-empty pinExpiresAt in the future.
  const freshGame = await store.getGame(pin);
  assert.ok(freshGame, 'game should exist');
  assert.ok(typeof freshGame?.pinExpiresAt === 'number', 'pinExpiresAt must be set on create');
  assert.ok((freshGame?.pinExpiresAt as number) > Date.now(), 'fresh PIN expires in the future');

  // A valid join works while the PIN is alive.
  const joinBefore = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'pin-exp-student', pin, name: 'Ali' }),
  });
  assert.equal(joinBefore.status, 200);
  assert.equal(((await joinBefore.json()) as { success: boolean }).success, true);

  // Force-expire the PIN.
  await store.withGameLock(pin, (game) => {
    game.pinExpiresAt = Date.now() - 1;
    return { ok: true, game };
  });

  // The same valid JOIN is now rejected as "no such active game".
  const joinAfter = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'pin-exp-student-2', pin, name: 'Ali' }),
  });
  assert.equal(joinAfter.status, 200);
  const joinAfterBody = (await joinAfter.json()) as { success: boolean; message?: string };
  assert.equal(joinAfterBody.success, false);
  assert.match(joinAfterBody.message ?? '', /faol o'yin topilmadi/i);
});

test('SECURITY: reset-game issues a game with a fresh (future) PIN expiry', async (t) => {
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

  const created = await fetch(`${base}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'pin-exp-teacher-2' }),
  });
  const createdBody = (await created.json()) as { success: boolean; sessionToken?: string };
  assert.equal(createdBody.success, true);
  const token = createdBody.sessionToken as string;

  const reset = await fetch(`${base}/api/reset-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId: 'pin-exp-teacher-2' }),
  });
  assert.equal(reset.status, 200);
  const resetBody = (await reset.json()) as { success: boolean; pin?: string };
  assert.equal(resetBody.success, true);

  const game = await store.getGame(resetBody.pin as string);
  assert.ok(game, 'reset game should exist');
  assert.ok(typeof game?.pinExpiresAt === 'number', 'reset-game sets a new pinExpiresAt');
  assert.ok((game?.pinExpiresAt as number) > Date.now(), 'reset PIN expires in the future');
});