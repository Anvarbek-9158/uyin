// Presence (QISM D/F/G), PIN regeneration (QISM E) and teacher-leave tests.
//
// Presence is backend-authoritative: heartbeat + grace. The pure sweeper
// (applyPresenceSweep) is unit-tested with a fake clock; the HTTP surface is
// integration-tested with a tiny student grace (250ms) and a very long teacher
// grace (100s, overridden inside the teacher-expiry test).
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.PRESENCE_TEACHER_GRACE_MS = '100000';
process.env.PRESENCE_STUDENT_GRACE_MS = '250';

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPresenceSweep } from '../src/server/presence.js';
import type { GameSession, Student, Team } from '../src/types.js';

const T0 = 1_000_000_000_000;

function makeGame(overrides: Partial<GameSession> = {}): GameSession {
  return {
    pin: '654321',
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
    createdAt: T0,
    teacherLastSeenAt: T0,
    currentRound: 1,
    questionsPerRound: 2,
    questionsPlayedInRound: 0,
    ...overrides,
  };
}

function makeStudent(
  id: string,
  name: string,
  lastSeenAt: number | null,
  teamId: string | null = null,
  isLeader = false
): Student {
  return { id, name, pin: '654321', teamId, isLeader, connected: true, lastSeenAt };
}

function makeTeam(id: string, memberIds: string[], leader: string | null): Team {
  return {
    id,
    name: 'Team',
    color: '#3b82f6',
    score: 100,
    leaderClientId: leader,
    memberIds,
    currentBet: null,
    currentAnswer: null,
    answerSubmittedAt: null,
    isEliminated: false,
    lastResult: null,
  };
}

// --- Unit tests: pure sweeper with a fake clock ------------------------------

test('unit: no stale clients -> nothing changes', () => {
  const game = makeGame();
  game.students['s1'] = makeStudent('s1', 'Ali', T0, 't1', true);
  game.teams['t1'] = makeTeam('t1', ['s1'], 's1');

  const res = applyPresenceSweep(game, T0 + 100);

  assert.equal(res.teacherEnded, false);
  assert.equal(res.removedStudents.length, 0);
  assert.equal(game.phase, 'LOBBY');
  assert.ok(game.students['s1']);
});

test('unit: teacher silent past grace -> game ends and students are not swept', () => {
  const game = makeGame();
  game.students['s1'] = makeStudent('s1', 'Ali', T0);

  const res = applyPresenceSweep(game, T0 + 1_000_000);

  assert.equal(res.teacherEnded, true);
  assert.equal(game.phase, 'GAME_OVER');
  assert.equal(game.isTimerRunning, false);
  assert.equal(res.removedStudents.length, 0);
  assert.ok(game.students['s1'], 'game state is kept for the teacher to resume');
});

test('unit: GAME_OVER is a no-op even when everyone is stale', () => {
  const game = makeGame({ phase: 'GAME_OVER' });
  game.students['s1'] = makeStudent('s1', 'Ali', T0);

  const res = applyPresenceSweep(game, T0 + 1_000_000);

  assert.equal(res.teacherEnded, false);
  assert.equal(res.removedStudents.length, 0);
});

test('unit: stale leader removed -> next member becomes leader (QISM G)', () => {
  const game = makeGame();
  game.students['s1'] = makeStudent('s1', 'Ali', T0 - 5000, 't1', true);
  game.students['s2'] = makeStudent('s2', 'Bilol', T0, 't1', false);
  game.teams['t1'] = makeTeam('t1', ['s1', 's2'], 's1');

  const res = applyPresenceSweep(game, T0 + 100);

  assert.deepEqual(res.removedStudents.map((s) => s.id), ['s1']);
  assert.ok(!game.students['s1'], 'stale student removed from the game');
  assert.ok(game.students['s2'], 'fresh teammate stays');
  assert.deepEqual(game.teams['t1'].memberIds, ['s2']);
  assert.equal(game.teams['t1'].leaderClientId, 's2', 'leadership transfers');
  assert.equal(game.students['s2'].isLeader, true);
});

test('unit: student without lastSeenAt (pre-feature) is never removed', () => {
  const game = makeGame();
  game.students['legacy'] = makeStudent('legacy', 'Otabek', null, 't1', true);
  game.teams['t1'] = makeTeam('t1', ['legacy'], 'legacy');

  const res = applyPresenceSweep(game, T0 + 100);

  assert.equal(res.removedStudents.length, 0);
  assert.ok(game.students['legacy']);
});

// --- Integration tests: HTTP surface ----------------------------------------

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

async function createGame(base: string, clientId: string): Promise<{ pin: string }> {
  const res = await fetch(`${base}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
  const body = (await res.json()) as { success: boolean; pin?: string };
  assert.equal(body.success, true);
  assert.ok(body.pin);
  return { pin: body.pin as string };
}

async function joinGame(base: string, clientId: string, pin: string, name: string): Promise<void> {
  const res = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, pin, name }),
  });
  const body = (await res.json()) as { success: boolean };
  assert.equal(body.success, true);
}

function post(base: string, path: string, body: Record<string, unknown>) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('integration: heartbeats stamp lastSeen; teacher-leave ends the game', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin } = await createGame(base, 'teacher-i1');
  await joinGame(base, 'student-i1', pin, 'Ali');

  const hb = await post(base, '/api/teacher-heartbeat', { clientId: 'teacher-i1' });
  assert.equal(((await hb.json()) as { success: boolean }).success, true);

  const shb = await post(base, '/api/student-heartbeat', { clientId: 'student-i1' });
  assert.equal(((await shb.json()) as { success: boolean }).success, true);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.ok(game.teacherLastSeenAt, 'teacher heartbeat stamps lastSeenAt');
  assert.ok(game.students['student-i1']?.lastSeenAt, 'student heartbeat stamps lastSeenAt');

  // teacher closes the tab -> game ends immediately (QISM F).
  const leave = await post(base, '/api/teacher-leave', { clientId: 'teacher-i1' });
  assert.equal(((await leave.json()) as { success: boolean }).success, true);
  const after = await store.getGame(pin);
  assert.equal(after?.phase, 'GAME_OVER');
});

test('integration: teacher silent past grace -> game auto-ends on next pull', async (t) => {
  const prevGrace = process.env.PRESENCE_TEACHER_GRACE_MS;
  process.env.PRESENCE_TEACHER_GRACE_MS = '250';
  try {
    const { base, close } = await startServer();
    t.after(close);
    const store = await import('../src/server/state.js');

    const { pin } = await createGame(base, 'teacher-i2');
    await new Promise((resolve) => setTimeout(resolve, 700)); // > teacher grace

    const res = await fetch(`${base}/api/game-state?clientId=teacher-i2`);
    const body = (await res.json()) as { success: boolean; game?: GameSession };
    assert.equal(body.success, true);
    assert.equal(body.game?.phase, 'GAME_OVER');

    const persisted = await store.getGame(pin);
    assert.equal(persisted?.phase, 'GAME_OVER', 'the sweep result is persisted');
  } finally {
    process.env.PRESENCE_TEACHER_GRACE_MS = prevGrace;
  }
});

test('integration: stale student removed on next heartbeat, leader transfers', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin } = await createGame(base, 'teacher-i3');
  await joinGame(base, 'student-a', pin, 'Ali');
  await joinGame(base, 'student-b', pin, 'Bilol');

  const teamRes = await post(base, '/api/create-team', {
    clientId: 'teacher-i3',
    pin,
    name: 'Alpha',
  });
  assert.equal(((await teamRes.json()) as { success: boolean }).success, true);
  const gameAfterTeam = await store.getGame(pin);
  assert.ok(gameAfterTeam);
  const teamId = Object.keys(gameAfterTeam.teams).at(-1) as string;
  await post(base, '/api/assign-student', { clientId: 'teacher-i3', studentId: 'student-a', teamId });
  await post(base, '/api/assign-student', { clientId: 'teacher-i3', studentId: 'student-b', teamId });

  // student-a heartbeats once, then goes silent for longer than the student grace.
  await post(base, '/api/student-heartbeat', { clientId: 'student-a' });
  await new Promise((resolve) => setTimeout(resolve, 700));

  // student-b reports in fresh; its own sweep removes stale student-a.
  const hb = await post(base, '/api/student-heartbeat', { clientId: 'student-b' });
  assert.equal(((await hb.json()) as { success: boolean }).success, true);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.ok(!game.students['student-a'], 'stale student removed from the game');
  assert.deepEqual(game.teams[teamId]?.memberIds, ['student-b']);
  assert.equal(game.teams[teamId]?.leaderClientId, 'student-b');
  assert.equal(game.students['student-b']?.isLeader, true);

  // the removed student's own heartbeat now reports failure
  const gone = await post(base, '/api/student-heartbeat', { clientId: 'student-a' });
  assert.equal(((await gone.json()) as { success: boolean }).success, false);
});

test('integration: regenerate-pin preserves teams+scores, clears students, new PIN works', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin } = await createGame(base, 'teacher-i4');
  await joinGame(base, 'student-c1', pin, 'Ali');
  await joinGame(base, 'student-c2', pin, 'Bilol');

  const teamRes = await post(base, '/api/create-team', {
    clientId: 'teacher-i4',
    pin,
    name: 'Alpha',
  });
  assert.equal(((await teamRes.json()) as { success: boolean }).success, true);
  const gameAfterTeam = await store.getGame(pin);
  assert.ok(gameAfterTeam);
  const teamId = Object.keys(gameAfterTeam.teams).at(-1) as string;
  await post(base, '/api/assign-student', { clientId: 'teacher-i4', studentId: 'student-c1', teamId });

  const seeded = await store.getGame(pin);
  assert.ok(seeded);
  seeded.teams[teamId].score = 250;
  await store.setGame(pin, seeded);

  const reg = await post(base, '/api/regenerate-pin', { clientId: 'teacher-i4' });
  const regBody = (await reg.json()) as { success: boolean; pin?: string; game?: GameSession };
  assert.equal(regBody.success, true);
  const newPin = regBody.pin as string;
  assert.ok(newPin && newPin !== pin);

  const game = regBody.game as GameSession;
  assert.equal(Object.keys(game.students).length, 0, 'students cleared');
  assert.ok(game.teams[teamId], 'team kept');
  assert.equal(game.teams[teamId].score, 250, 'score kept');
  assert.deepEqual(game.teams[teamId].memberIds, [], 'memberships cleared');
  assert.equal(game.teacherLastSeenAt != null, true, 'teacher presence restamped');

  // Old game is gone and the students can no longer act on it.
  assert.equal(await store.getGame(pin), null);
  assert.equal(await store.getStudentPin('student-c1'), null);

  // A student can re-join with the fresh PIN.
  await joinGame(base, 'student-c1', newPin, 'Ali');
});
