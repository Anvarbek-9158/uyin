// Rounds (QISM H) tests.
//
// A "raund" is a fixed-size chunk of consecutive questions (questionsPerRound).
// /api/start-betting-phase counts each started question into
// questionsPlayedInRound; /api/finish-round only advances currentRound once the
// budget is spent and resets the counter. Finishing is only valid from the
// GRADING phase (double-finish guard), and the last standing team ends the
// game regardless of the round budget.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.QUESTIONS_PER_ROUND = '2';

import test from 'node:test';
import assert from 'node:assert/strict';
import { questionsPerRound } from '../src/server/presence.js';
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

function post(base: string, path: string, body: Record<string, unknown>, token?: string | null) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function createGame(base: string, clientId: string): Promise<{ pin: string; sessionToken: string }> {
  const res = await post(base, '/api/create-game', { clientId });
  const body = (await res.json()) as { success: boolean; pin?: string; sessionToken?: string };
  assert.equal(body.success, true);
  assert.ok(body.pin);
  assert.ok(body.sessionToken);
  return { pin: body.pin as string, sessionToken: body.sessionToken as string };
}

async function joinGame(base: string, clientId: string, pin: string, name: string): Promise<void> {
  const res = await post(base, '/api/join-game', { clientId, pin, name });
  const body = (await res.json()) as { success: boolean };
  assert.equal(body.success, true);
}

// Creates a game with `n` single-member teams and returns { pin, teamIds }.
async function gameWithTeams(
  base: string,
  teacherId: string,
  n: number
): Promise<{ pin: string; teamIds: string[]; sessionToken: string }> {
  const store = await import('../src/server/state.js');
  const { pin, sessionToken } = await createGame(base, teacherId);
  const teamIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const studentId = `${teacherId}-s${i}`;
    await joinGame(base, studentId, pin, `Talaba ${i + 1}`);
    const res = await post(base, '/api/create-team', {
      clientId: teacherId,
      name: `Jamoa ${i + 1}`,
    }, sessionToken);
    assert.equal(((await res.json()) as { success: boolean }).success, true);
    const game = await store.getGame(pin);
    assert.ok(game);
    const teamId = Object.keys(game.teams).at(-1) as string;
    teamIds.push(teamId);
    await post(base, '/api/assign-student', {
      clientId: teacherId,
      studentId,
      teamId,
    }, sessionToken);
  }
  return { pin, teamIds, sessionToken };
}

// Plays one question up to GRADING and finishes the round.
async function playAndFinishRound(base: string, teacherId: string, sessionToken: string): Promise<void> {
  const start = await post(base, '/api/start-betting-phase', { clientId: teacherId }, sessionToken);
  assert.equal(((await start.json()) as { success: boolean }).success, true);
  const phase = await post(base, '/api/set-game-phase', { clientId: teacherId, phase: 'GRADING' }, sessionToken);
  assert.equal(((await phase.json()) as { success: boolean }).success, true);
  const finish = await post(base, '/api/finish-round', { clientId: teacherId }, sessionToken);
  assert.equal(((await finish.json()) as { success: boolean }).success, true);
}

// --- Unit tests: questionsPerRound ------------------------------------------

test('unit: questionsPerRound honours env override and falls back to 1', () => {
  const prev = process.env.QUESTIONS_PER_ROUND;
  try {
    process.env.QUESTIONS_PER_ROUND = '3';
    assert.equal(questionsPerRound(), 3);
    process.env.QUESTIONS_PER_ROUND = '0';
    assert.equal(questionsPerRound(), 1);
    process.env.QUESTIONS_PER_ROUND = 'abc';
    assert.equal(questionsPerRound(), 1);
    delete process.env.QUESTIONS_PER_ROUND;
    assert.equal(questionsPerRound(), 1);
  } finally {
    process.env.QUESTIONS_PER_ROUND = prev;
  }
});

// --- Integration tests: HTTP surface ----------------------------------------

test('integration: create-game persists the configured questionsPerRound', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin } = await createGame(base, 'teacher-r0');
  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.questionsPerRound, 2);
  assert.equal(game.currentRound, 1);
  assert.equal(game.questionsPlayedInRound, 0);
});

test('integration: start-betting-phase counts questions started in the round', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r1', 2);

  const s1 = await post(base, '/api/start-betting-phase', { clientId: 'teacher-r1' }, sessionToken);
  assert.equal(((await s1.json()) as { success: boolean }).success, true);
  const s2 = await post(base, '/api/start-betting-phase', { clientId: 'teacher-r1' }, sessionToken);
  assert.equal(((await s2.json()) as { success: boolean }).success, true);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.questionsPlayedInRound, 2);
  assert.equal(game.currentRound, 1);
  assert.equal(game.phase, 'BETTING');
});

test('integration: finish-round below budget keeps round, shows round results', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r2', 2);
  await playAndFinishRound(base, 'teacher-r2', sessionToken);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'ROUND_RESULT');
  assert.equal(game.currentRound, 1, 'round does not advance below the budget');
  assert.equal(game.questionsPlayedInRound, 1, 'counter is preserved below the budget');
});

test('integration: finish-round at the budget advances the round and resets the counter', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, teamIds, sessionToken } = await gameWithTeams(base, 'teacher-r3', 2);

  // Round 1: one question played, finished below budget.
  await playAndFinishRound(base, 'teacher-r3', sessionToken);
  let game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'ROUND_RESULT');
  assert.equal(game.currentRound, 1);

  // Next question still belongs to round 1.
  const nq = await post(base, '/api/next-question', { clientId: 'teacher-r3' }, sessionToken);
  assert.equal(((await nq.json()) as { success: boolean }).success, true);
  await playAndFinishRound(base, 'teacher-r3', sessionToken);

  game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.currentRound, 2, 'round advances at the budget boundary');
  assert.equal(game.questionsPlayedInRound, 0, 'counter resets when the round advances');
  assert.equal(game.phase, 'ROUND_RESULT');
  // Scores stay cumulative across rounds.
  for (const teamId of teamIds) {
    assert.equal(game.teams[teamId]?.score, 100);
  }
});

test('integration: student game-state in BETTING hides the current question text/options/correctAnswer', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r8', 2);

  const start = await post(base, '/api/start-betting-phase', { clientId: 'teacher-r8', questionIndex: 0 }, sessionToken);
  assert.equal(((await start.json()) as { success: boolean }).success, true);
  const state = await store.getGame(pin);
  assert.ok(state);
  assert.equal(state.phase, 'BETTING');
  const currentIndex = state.currentQuestionIndex;
  assert.ok(state.questions[currentIndex]?.text, 'teacher-authoritative state keeps the question');

  // The student (public) view must strip the current question's text/options
  // and every correctAnswer while we are still in BETTING.
  const res = await fetch(`${base}/api/game-state?clientId=teacher-r8-s0`);
  const body = (await res.json()) as { success: boolean; game?: GameSession };
  assert.equal(body.success, true);
  const q = body.game?.questions[currentIndex];
  assert.ok(q, 'student still sees the question index so the UI can number it');
  assert.equal(q?.text, '', 'current question text must be hidden during BETTING');
  assert.equal(q?.options?.length ?? 0, 0, 'current question options must be hidden during BETTING');
  assert.equal(q?.correctAnswer, '', 'correctAnswer must never leak during BETTING');
});

test('integration: with default 1 question per round, finishing one question advances the round and resets the counter', async (t) => {
  const prev = process.env.QUESTIONS_PER_ROUND;
  process.env.QUESTIONS_PER_ROUND = '1';
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  try {
    const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r7', 2);
    let game = await store.getGame(pin);
    assert.ok(game);
    assert.equal(game.questionsPerRound, 1, 'game adopts the default 1 question per round');
    assert.equal(game.currentRound, 1);
    assert.equal(game.questionsPlayedInRound, 0);

    // Play a single question and finish it.
    await post(base, '/api/start-betting-phase', { clientId: 'teacher-r7' }, sessionToken);
    await post(base, '/api/set-game-phase', { clientId: 'teacher-r7', phase: 'GRADING' }, sessionToken);
    const finish = await post(base, '/api/finish-round', { clientId: 'teacher-r7' }, sessionToken);
    assert.equal(((await finish.json()) as { success: boolean }).success, true);

    game = await store.getGame(pin);
    assert.ok(game);
    assert.equal(game.currentRound, 2, 'round advances after a single question');
    assert.equal(game.questionsPlayedInRound, 0, 'counter resets when the round advances');
    assert.equal(game.phase, 'ROUND_RESULT');
  } finally {
    process.env.QUESTIONS_PER_ROUND = prev;
  }
});

test('integration: finishing twice is guarded (only from GRADING)', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r4', 2);
  await playAndFinishRound(base, 'teacher-r4', sessionToken);

  let game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'ROUND_RESULT');

  const again = await post(base, '/api/finish-round', { clientId: 'teacher-r4' }, sessionToken);
  const body = (await again.json()) as { success: boolean; message?: string };
  assert.equal(body.success, false, 'finishing from ROUND_RESULT is rejected');

  game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'ROUND_RESULT');
  assert.equal(game.currentRound, 1);
});

test('integration: last standing team ends the game regardless of round budget', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, sessionToken } = await gameWithTeams(base, 'teacher-r5', 1);
  await playAndFinishRound(base, 'teacher-r5', sessionToken);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'GAME_OVER');
  assert.equal(game.currentRound, 1, 'game over wins over round advancement');
});

test('integration: reset-game-keep-teams resets round counters but keeps teams', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const { pin, teamIds, sessionToken } = await gameWithTeams(base, 'teacher-r6', 2);

  // Give the game a larger bank so the unlimited-round flow below (which starts
  // several questions, each one being marked "used") does not exhaust the
  // 3-question default bank before we reach the reset step.
  const bigBank = [
    { id: 'q_a', text: 'A1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 20, category: 'T', difficulty: 'Oson' },
    { id: 'q_b', text: 'B1?', options: ['A', 'B'], correctAnswer: 'B', timeLimit: 20, category: 'T', difficulty: 'Oson' },
    { id: 'q_c', text: 'C1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 20, category: 'T', difficulty: 'Oson' },
    { id: 'q_d', text: 'D1?', options: ['A', 'B'], correctAnswer: 'B', timeLimit: 20, category: 'T', difficulty: 'Oson' },
    { id: 'q_e', text: 'E1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 20, category: 'T', difficulty: 'Oson' },
  ];
  const sq = await post(base, '/api/set-questions', { clientId: 'teacher-r6', questions: bigBank }, sessionToken);
  assert.equal(((await sq.json()) as { success: boolean }).success, true);

  // Drive the game into round 2 with one question started inside it.
  await playAndFinishRound(base, 'teacher-r6', sessionToken); // question 1, round 1
  const nq = await post(base, '/api/next-question', { clientId: 'teacher-r6' }, sessionToken);
  assert.equal(((await nq.json()) as { success: boolean }).success, true);
  await playAndFinishRound(base, 'teacher-r6', sessionToken); // question 2 -> round 2, counter reset
  const s = await post(base, '/api/start-betting-phase', { clientId: 'teacher-r6' }, sessionToken);
  assert.equal(((await s.json()) as { success: boolean }).success, true);

  const reset = await post(base, '/api/reset-game-keep-teams', { clientId: 'teacher-r6' }, sessionToken);
  assert.equal(((await reset.json()) as { success: boolean }).success, true);

  const game = await store.getGame(pin);
  assert.ok(game);
  assert.equal(game.phase, 'TEAMS_SETUP');
  assert.equal(game.currentRound, 1);
  assert.equal(game.questionsPlayedInRound, 0);
  assert.equal(Object.keys(game.teams).length, 2, 'teams are preserved');
  for (const teamId of teamIds) {
    assert.ok(game.teams[teamId], 'team still exists');
    assert.equal(game.teams[teamId].score, 100, 'scores are preserved');
  }
});
