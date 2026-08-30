// Non-repeating questions + unlimited rounds (QISM I) tests.
//
// A question may never be started twice across the whole game. usedQuestionIds
// accumulates on /api/start-betting-phase and /api/next-question; both refuse to
// hand out an already-used question, and once the whole bank has been used the
// game is declared over (GAME_OVER) regardless of how many rounds have passed.

process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.QUESTIONS_PER_ROUND = '2';

import test from 'node:test';
import assert from 'node:assert/strict';

const BANK = [
  { id: 'q_a', text: 'A1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 20, category: 'T', difficulty: 'Oson' },
  { id: 'q_b', text: 'B1?', options: ['A', 'B'], correctAnswer: 'B', timeLimit: 20, category: 'T', difficulty: 'Oson' },
  { id: 'q_c', text: 'C1?', options: ['A', 'B'], correctAnswer: 'A', timeLimit: 20, category: 'T', difficulty: 'Oson' },
];

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
  return { pin: body.pin as string, sessionToken: body.sessionToken as string };
}

async function newGameWithBank(base: string, teacherId: string): Promise<{ pin: string; sessionToken: string }> {
  const { pin, sessionToken } = await createGame(base, teacherId);
  const sq = await post(base, '/api/set-questions', { clientId: teacherId, questions: BANK }, sessionToken);
  assert.equal(((await sq.json()) as { success: boolean }).success, true);
  return { pin, sessionToken };
}

test('start-betting-phase refuses a question that has already been used', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');
  const { pin, sessionToken } = await newGameWithBank(base, 'teacher-n1');

  // Start q_a via index 0.
  const first = await post(base, '/api/start-betting-phase', { clientId: 'teacher-n1', questionIndex: 0 }, sessionToken);
  assert.equal(((await first.json()) as { success: boolean }).success, true);
  let g = await store.getGame(pin);
  assert.ok(g);
  assert.deepEqual(g.usedQuestionIds, ['q_a']);

  // Trying to start q_a again is rejected.
  const dup = await post(base, '/api/start-betting-phase', { clientId: 'teacher-n1', questionIndex: 0 }, sessionToken);
  const dupBody = (await dup.json()) as { success: boolean; message?: string };
  assert.equal(dupBody.success, false);
  assert.match(dupBody.message ?? '', /ishlatilgan/i);

  // The fresh question q_b still starts fine.
  const second = await post(base, '/api/start-betting-phase', { clientId: 'teacher-n1', questionIndex: 1 }, sessionToken);
  assert.equal(((await second.json()) as { success: boolean }).success, true);
  g = await store.getGame(pin);
  assert.ok(g);
  assert.deepEqual(g.usedQuestionIds, ['q_a', 'q_b']);
});

test('next-question always picks an unused question and never repeats', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');
  const { pin, sessionToken } = await newGameWithBank(base, 'teacher-n2');

  // Round 1: start q_a, then advance to q_b via next-question.
  await post(base, '/api/start-betting-phase', { clientId: 'teacher-n2', questionIndex: 0 }, sessionToken);
  const nq = await post(base, '/api/next-question', { clientId: 'teacher-n2' }, sessionToken);
  assert.equal(((await nq.json()) as { success: boolean }).success, true);
  let g = await store.getGame(pin);
  assert.ok(g);
  assert.equal(g.questions[g.currentQuestionIndex].id, 'q_b', 'next-question advances to an unused question');
  assert.deepEqual(g.usedQuestionIds, ['q_a', 'q_b']);
});

test('game ends (GAME_OVER) once every question in the bank has been used', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');
  const { pin, sessionToken } = await newGameWithBank(base, 'teacher-n3');

  // Use q_a and q_b first.
  await post(base, '/api/start-betting-phase', { clientId: 'teacher-n3', questionIndex: 0 }, sessionToken);
  const nq = await post(base, '/api/next-question', { clientId: 'teacher-n3' }, sessionToken);
  assert.equal(((await nq.json()) as { success: boolean }).success, true);

  // Only q_c remains; next-question uses it and then the bank is exhausted.
  const nq2 = await post(base, '/api/next-question', { clientId: 'teacher-n3' }, sessionToken);
  assert.equal(((await nq2.json()) as { success: boolean }).success, true);
  let g = await store.getGame(pin);
  assert.ok(g);
  assert.equal(g.questions[g.currentQuestionIndex].id, 'q_c');
  assert.deepEqual(g.usedQuestionIds, ['q_a', 'q_b', 'q_c']);

  // No unused questions remain -> next-question declares GAME_OVER.
  const nq3 = await post(base, '/api/next-question', { clientId: 'teacher-n3' }, sessionToken);
  assert.equal(((await nq3.json()) as { success: boolean }).success, true);
  g = await store.getGame(pin);
  assert.ok(g);
  assert.equal(g.phase, 'GAME_OVER', 'bank exhausted -> game over');
});
