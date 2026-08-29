// Regression test for the "first student login is not visible in the teacher
// panel" bug.
//
// Root cause: the teacher panel is updated only by live Pusher `game_state`
// events. Subscribing to a channel is asynchronous, so the broadcast for the
// FIRST student join can be dropped by Channels (events are not replayed). The
// fix relies on two invariants:
//   1. the student is persisted BEFORE the join response is sent, and
//   2. a `/api/game-state` endpoint clients pull once their subscription is
//      live, so any missed event is recovered.
// This test asserts both. If the teacher can fetch the first student right after
// their very first login, the panel can never stay stale.

// Force the in-memory store (no Redis) and make every Pusher trigger fail fast
// so the test is hermetic and never touches the network. These assignments MUST
// happen before app.ts (which runs `dotenv/config`) is imported, and dotenv does
// not overwrite already-set variables.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';

import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameSession } from '../src/types.js';

const PIN = '123456';

function makeGame(): GameSession {
  return {
    pin: PIN,
    teacherClientId: 'teacher-1',
    phase: 'LOBBY',
    students: {},
    teams: {},
    questions: [],
    currentQuestionIndex: 0,
    timerSeconds: 30,
    isTimerRunning: false,
    maxScoreLimit: 500,
    feedbacks: [],
    createdAt: Date.now(),
  };
}

test('first student login is persisted and visible via /api/game-state', async (t) => {
  const { default: app } = await import('../app.js');
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame());
  await store.setTeacherPin('teacher-1', PIN);

  const server = app.listen(0);
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  // The student's very first login.
  const joinRes = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'student-1', pin: PIN, name: 'Ali' }),
  });
  const joinBody = (await joinRes.json()) as { success: boolean; studentId?: string };
  assert.equal(joinBody.success, true);
  assert.equal(joinBody.studentId, 'student-1');

  // Invariant 1: the write is committed BEFORE the join response is sent, so a
  // client pulling state at any point after this response already sees the
  // student.
  const persisted = await store.getGame(PIN);
  assert.ok(persisted?.students['student-1'], 'student must be persisted before the join response');
  assert.equal(persisted.students['student-1'].connected, true);

  // Invariant 2: the reconciliation endpoint returns the authoritative state,
  // including the very first student, to the teacher (and to the student).
  const teacherRes = await fetch(`${base}/api/game-state?clientId=teacher-1`);
  const teacherBody = (await teacherRes.json()) as { success: boolean; game?: GameSession };
  assert.equal(teacherBody.success, true);
  assert.ok(teacherBody.game?.students['student-1'], 'teacher reconcile fetch sees the first student');
  assert.equal(teacherBody.game.students['student-1'].name, 'Ali');

  const studentRes = await fetch(`${base}/api/game-state?clientId=student-1`);
  const studentBody = (await studentRes.json()) as { success: boolean; game?: GameSession };
  assert.equal(studentBody.success, true);
  assert.ok(studentBody.game?.students['student-1']);
});

test('SECURITY: a different clientId cannot hijack an existing student by reusing their name', async (t) => {
  const { default: app } = await import('../app.js');
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame());
  await store.setTeacherPin('teacher-1', PIN);

  const server = app.listen(0);
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  // The legitimate student joins as "Ali" under clientId 'student-1'.
  const first = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'student-1', pin: PIN, name: 'Ali' }),
  });
  const firstBody = (await first.json()) as { success: boolean; studentId?: string; sessionToken?: string };
  assert.equal(firstBody.success, true);

  // An attacker with a DIFFERENT clientId tries to take over the same name.
  const hijack = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'attacker-9', pin: PIN, name: 'Ali' }),
  });
  const hijackBody = (await hijack.json()) as { success: boolean; message?: string };
  assert.equal(hijackBody.success, false, 'name reuse by a different clientId must be rejected');
  assert.ok(hijackBody.message && hijackBody.message.length > 0);

  // The original owner is untouched: still present under their own clientId.
  const game = await store.getGame(PIN);
  assert.ok(game?.students['student-1'], 'the original student must not be displaced');
  assert.ok(!game?.students['attacker-9'], 'the attacker must not take the seat');
  assert.equal(game?.students['student-1'].name, 'Ali');
});

test('teacher-approved reconnect lets a new device reclaim a name while keeping team membership', async (t) => {
  const { default: app } = await import('../app.js');
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame());

  const server = app.listen(0);
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const post = (path: string, body: Record<string, unknown>, token?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> }));

  // Register the teacher against the manually-seeded game (PIN 123456) and mint
  // a session token for them. create-game is NOT used here because it allocates
  // a fresh random-pin game; we want the teacher to operate the seeded one.
  await store.setTeacherPin('teacher-1', PIN);
  const teacherToken = await store.createSessionToken('teacher-1');

  // Student "Ali" joins on device A and gets a session token.
  const joinA = (await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'device-A', pin: PIN, name: 'Ali' }),
  }).then((r) => r.json())) as { success: boolean; sessionToken: string };
  assert.equal(joinA.success, true);
  const oldToken = joinA.sessionToken;

  // Put Ali in a team so we can verify membership survives the reclaim.
  const team = await post('/api/create-team', { clientId: 'teacher-1', name: 'Jamoa' }, teacherToken);
  assert.equal(team.status, 200);
  assert.equal((team.body as { success: boolean }).success, true);
  const teamGame = await store.getGame(PIN);
  const teamId = Object.keys(teamGame?.teams ?? {}).at(-1);
  assert.ok(teamId);
  await post('/api/assign-student', { clientId: 'teacher-1', studentId: 'device-A', teamId }, teacherToken);

  // A new device (fresh clientId) can NOT reclaim "Ali" without the teacher.
  const reject = await post('/api/join-game', { clientId: 'device-B', pin: PIN, name: 'Ali' });
  assert.equal((reject.body as { success: boolean }).success, false);

  // Teacher presses "Qayta ulash" -> the name is cleared for re-claim.
  const clear = await post(
    '/api/reconnect-student',
    { clientId: 'teacher-1', studentId: 'device-A' },
    teacherToken
  );
  assert.equal(clear.status, 200);
  assert.equal((clear.body as { success: boolean }).success, true);

  // The new device joins and takes over the seat, keeping its team membership.
  const reclaim = await post('/api/join-game', { clientId: 'device-B', pin: PIN, name: 'Ali' });
  assert.equal((reclaim.body as { success: boolean }).success, true, 'teacher-cleared name must be reclaimable');

  const game = await store.getGame(PIN);
  assert.ok(game?.students['device-B'], 'device-B must now hold the seat');
  assert.ok(!game?.students['device-A'], 'device-A must be displaced (session revoked)');
  assert.equal(game?.students['device-B'].teamId, teamId, 'team membership must survive the reclaim');
  assert.equal(game?.students['device-B'].name, 'Ali');

  // The whitelist entry is consumed, so a THIRD device cannot abuse it.
  const tooFar = await post('/api/join-game', { clientId: 'device-C', pin: PIN, name: 'Ali' });
  assert.equal((tooFar.body as { success: boolean }).success, false, 'reclaim opportunity must be single-use');

  // The old device's session token was revoked.
  const expired = await store.verifyClientSession('device-A', oldToken);
  assert.equal(expired.ok, false, 'old session token must be revoked after reclaim');
});
