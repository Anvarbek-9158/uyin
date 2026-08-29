// Security test for teacher-only endpoints.
//
// Every teacher action (/api/reset-game, /api/kick-student, /api/delete-team,
// /api/update-pin, /api/regenerate-pin, /api/grade-team-answer, /api/set-questions,
// /api/create-team, /api/assign-student, ...) must require a valid session token
// in addition to the clientId. A stolen teacher clientId alone is NOT enough to
// act on a game.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';

import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameSession } from '../src/types.js';

interface ServerCtx {
  base: string;
  close: () => void;
}

async function startServer(): Promise<ServerCtx> {
  const { default: app } = await import('../app.js');
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const close = () => {
    server.closeAllConnections();
    server.close();
  };
  return { base, close };
}

function post(
  base: string,
  path: string,
  body: Record<string, unknown>,
  token?: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> }));
}

// The set of teacher-only endpoints that must all be token-gated.
const TEACHER_ENDPOINTS: { path: string; body: Record<string, unknown> }[] = [
  { path: '/api/reset-game', body: {} },
  { path: '/api/reset-game-keep-teams', body: {} },
  { path: '/api/kick-student', body: { studentId: 'someone' } },
  { path: '/api/reconnect-student', body: { studentId: 'someone' } },
  { path: '/api/delete-team', body: { teamId: 'team_x' } },
  { path: '/api/create-team', body: { name: 'X' } },
  { path: '/api/assign-student', body: { studentId: 'someone', teamId: 'team_x' } },
  { path: '/api/bulk-assign-students', body: { studentIds: [] } },
  { path: '/api/set-team-leader', body: { studentId: 'someone', teamId: 'team_x' } },
  { path: '/api/penalize-team', body: { teamId: 'team_x' } },
  { path: '/api/set-questions', body: { questions: [] } },
  { path: '/api/start-betting-phase', body: {} },
  { path: '/api/start-answering-phase', body: {} },
  { path: '/api/stop-answering-phase', body: {} },
  { path: '/api/grade-team-answer', body: { teamId: 'team_x' } },
  { path: '/api/finish-round', body: {} },
  { path: '/api/next-question', body: {} },
  { path: '/api/set-game-phase', body: { phase: 'LOBBY' } },
  { path: '/api/update-pin', body: { newPin: '123456' } },
  { path: '/api/regenerate-pin', body: {} },
  { path: '/api/teacher-heartbeat', body: {} },
  { path: '/api/timer-tick', body: { seconds: 10 } },
];

test('SECURITY: teacher endpoints reject a missing or wrong session token with 401', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  // The teacher registers a game and receives a session token.
  const created = await post(base, '/api/create-game', { clientId: 'teacher-sec' });
  assert.equal(created.status, 200);
  assert.equal((created.body as { success: boolean }).success, true);
  const sessionToken = (created.body as { sessionToken: string }).sessionToken;

  // 1) No token at all -> every teacher endpoint must reject with 401.
  for (const ep of TEACHER_ENDPOINTS) {
    const res = await post(base, ep.path, { clientId: 'teacher-sec', ...ep.body }, null);
    assert.equal(
      res.status,
      401,
      `${ep.path} without a session token must be rejected with 401`
    );
  }

  // 2) A wrong token -> every teacher endpoint must reject with 401.
  for (const ep of TEACHER_ENDPOINTS) {
    const res = await post(base, ep.path, { clientId: 'teacher-sec', ...ep.body }, 'f'.repeat(64));
    assert.equal(
      res.status,
      401,
      `${ep.path} with a wrong session token must be rejected with 401`
    );
  }
});

test('SECURITY: a stolen teacher clientId with NO token cannot act on a game', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await post(base, '/api/create-game', { clientId: 'teacher-sec2' });
  assert.equal(created.status, 200);
  const pin = (created.body as { pin: string }).pin;

  // An attacker knows the clientId but not the token (token is unguessable),
  // so they send no Authorization header. Every teacher action must fail.
  const res = await post(base, '/api/kick-student', { clientId: 'teacher-sec2', studentId: 'victim' }, null);
  assert.equal(res.status, 401);

  // The authoritative state was NOT mutated.
  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(Object.keys(game.students).length, 0);
});

test('SECURITY: a valid teacher session token lets teacher endpoints through', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await post(base, '/api/create-game', { clientId: 'teacher-sec3' });
  const sessionToken = (created.body as { sessionToken: string }).sessionToken;

  const res = await post(base, '/api/create-team', { clientId: 'teacher-sec3', name: 'Lochinlar' }, sessionToken);
  assert.equal(res.status, 200);
  assert.equal((res.body as { success: boolean }).success, true);

  const game = await store.getGame((created.body as { pin: string }).pin);
  assert.ok(game);
  assert.equal(Object.keys(game.teams).length, 1);
});

test('SECURITY: a student token cannot authorize teacher actions on the teacher game', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await post(base, '/api/create-game', { clientId: 'teacher-sec4' });
  const teacherToken = (created.body as { sessionToken: string }).sessionToken;
  const pin = (created.body as { pin: string }).pin;

  // A student joins and gets their own token.
  const joined = await post(base, '/api/join-game', { clientId: 'student-sec4', pin, name: 'Ali' }, null);
  assert.equal(joined.status, 200);
  const studentToken = (joined.body as { sessionToken: string }).sessionToken;
  assert.notEqual(teacherToken, studentToken);

  // The student's token does NOT authorize the (teacher-owned) endpoint even
  // though the request also uses the teacher's clientId — the token is bound to
  // the student, so the session check fails.
  const res = await post(base, '/api/reset-game', { clientId: 'teacher-sec4' }, studentToken);
  assert.equal(res.status, 401, 'a token bound to a different client must not authorize');
});
