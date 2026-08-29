// End-game & announce winners (QISM J / VAZIFA 6) tests.
//
// /api/end-game-and-announce-winners sets phase to GAME_OVER and persists the
// champion team id(s): the top-scoring non-eliminated team, with ties yielding
// multiple champions. When every team has <= 0 score no winner is announced.

process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';

import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameSession, Team } from '../src/types.js';

const PIN = '654321';

function makeGame(teams: Record<string, Team>): GameSession {
  return {
    pin: PIN,
    teacherClientId: 'teacher-w',
    phase: 'ANSWERING',
    students: {},
    teams,
    questions: [{ id: 'q_1', text: 'Q1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 30, category: 'T', difficulty: 'Oson' }],
    currentQuestionIndex: 0,
    timerSeconds: 30,
    isTimerRunning: true,
    maxScoreLimit: 500,
    feedbacks: [],
    createdAt: Date.now(),
  };
}

function makeTeam(id: string, name: string, score: number, eliminated = false): Team {
  return {
    id,
    name,
    color: '#000',
    score,
    leaderClientId: null,
    memberIds: [],
    currentBet: null,
    currentAnswer: null,
    answerSubmittedAt: null,
    isEliminated: eliminated,
    lastResult: null,
  };
}

async function startServer(): Promise<{ base: string; close: () => void }> {
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

test('end-game-and-announce-winners sets GAME_OVER and picks the top team as winner', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame({
    t1: makeTeam('t1', 'A', 320),
    t2: makeTeam('t2', 'B', 480),
    t3: makeTeam('t3', 'C', 120),
  }));
  await store.setTeacherPin('teacher-w', PIN);
  const token = await store.createSessionToken('teacher-w');

  const res = await fetch(`${base}/api/end-game-and-announce-winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId: 'teacher-w' }),
  });
  const body = (await res.json()) as { success: boolean };
  assert.equal(body.success, true);

  const game = await store.getGame(PIN);
  assert.ok(game);
  assert.equal(game.phase, 'GAME_OVER');
  assert.equal(game.isTimerRunning, false);
  assert.deepEqual(game.winners, ['t2'], 'top-scoring team is the sole winner');
});

test('a tie at the top yields multiple champions', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame({
    t1: makeTeam('t1', 'A', 400),
    t2: makeTeam('t2', 'B', 400),
    t3: makeTeam('t3', 'C', 90),
  }));
  await store.setTeacherPin('teacher-w', PIN);
  const token = await store.createSessionToken('teacher-w');

  const res = await fetch(`${base}/api/end-game-and-announce-winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId: 'teacher-w' }),
  });
  assert.equal(((await res.json()) as { success: boolean }).success, true);

  const game = await store.getGame(PIN);
  assert.ok(game);
  assert.equal(game.phase, 'GAME_OVER');
  assert.deepEqual((game.winners ?? []).slice().sort(), ['t1', 't2'], 'tied top teams are both winners');
});

test('eliminated teams are excluded from winning, and all-broke means no winner', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  // t_hi is eliminated (score is high but team was eliminated) — must not win.
  await store.setGame(PIN, makeGame({
    t_hi: makeTeam('t_hi', 'Hi', 900, true),
    t_a: makeTeam('t_a', 'A', 100),
  }));
  await store.setTeacherPin('teacher-w', PIN);
  const token = await store.createSessionToken('teacher-w');

  const res = await fetch(`${base}/api/end-game-and-announce-winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId: 'teacher-w' }),
  });
  assert.equal(((await res.json()) as { success: boolean }).success, true);

  const game = await store.getGame(PIN);
  assert.ok(game);
  assert.deepEqual(game.winners, ['t_a'], 'only the non-eliminated top team wins');

  // All teams bankrupt -> no winner announced.
  await store.setGame(PIN, makeGame({
    x1: makeTeam('x1', 'A', 0),
    x2: makeTeam('x2', 'B', 0),
  }));
  const res2 = await fetch(`${base}/api/end-game-and-announce-winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId: 'teacher-w' }),
  });
  assert.equal(((await res2.json()) as { success: boolean }).success, true);
  const game2 = await store.getGame(PIN);
  assert.ok(game2);
  assert.deepEqual(game2.winners, [], 'no winner when no team has a positive score');
});
