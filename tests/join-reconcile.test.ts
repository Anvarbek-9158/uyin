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
