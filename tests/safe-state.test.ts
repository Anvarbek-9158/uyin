// Security test for the role-filtered game state (QISM VAZIFA 1).
//
// A student must NEVER receive the current question's text/options or any
// question's correctAnswer during BETTING, and never receive any correctAnswer
// during ANSWERING — even by reading the raw payload (CSS hiding is not enough,
// so the server physically strips the fields). The teacher, in contrast, always
// gets the FULL state (question + correct answer).

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

const QUESTION = {
  id: 'q_1',
  text: 'Qaysi dasturlash tili?',
  options: ['A', 'B', 'C'],
  correctAnswer: 'B',
  timeLimit: 30,
  category: 'Test',
  difficulty: 'Oson' as const,
};

function makeGame(): GameSession {
  return {
    pin: PIN,
    teacherClientId: 'teacher-1',
    phase: 'BETTING',
    students: {},
    teams: {},
    questions: [QUESTION],
    currentQuestionIndex: 0,
    timerSeconds: 30,
    isTimerRunning: false,
    maxScoreLimit: 500,
    feedbacks: [],
    createdAt: Date.now(),
  };
}

async function startServer() {
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

test('student game-state in BETTING hides the current question text/options and all correctAnswers', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame());
  await store.setTeacherPin('teacher-1', PIN);
  await store.setStudentPin('student-1', PIN);
  await store.createSessionToken('student-1');
  await store.createSessionToken('teacher-1');
  await store.setGame(PIN, { ...makeGame(), students: { 'student-1': { id: 'student-1', name: 'Ali', pin: PIN, teamId: null, isLeader: false, connected: true } } });

  // Teacher must see the FULL state (question text, options, correct answer).
  const teacherRes = await fetch(`${base}/api/game-state?clientId=teacher-1`);
  const teacherBody = (await teacherRes.json()) as { success: boolean; game?: GameSession };
  assert.equal(teacherBody.success, true);
  assert.equal(teacherBody.game?.questions[0].text, QUESTION.text);
  assert.equal(teacherBody.game?.questions[0].options?.length, 3);
  assert.equal(teacherBody.game?.questions[0].correctAnswer, QUESTION.correctAnswer);

  // Student must NOT see the current question text/options nor the correctAnswer.
  const studentRes = await fetch(`${base}/api/game-state?clientId=student-1`);
  const studentBody = (await studentRes.json()) as { success: boolean; game?: GameSession };
  assert.equal(studentBody.success, true);
  const q = studentBody.game?.questions[0];
  assert.ok(q, 'student still receives the question index (so the UI can number it)');
  assert.equal(q?.text, '', 'current question text must be stripped for students in BETTING');
  assert.equal(q?.options?.length ?? 0, 0, 'current question options must be stripped in BETTING');
  assert.equal(q?.correctAnswer, '', 'correctAnswer must always be stripped for students');
});

test('student join-game response is also student-safe', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  await store.setGame(PIN, makeGame());
  await store.setTeacherPin('teacher-1', PIN);

  const res = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 's2', pin: PIN, name: 'Bobur' }),
  });
  const body = (await res.json()) as { success: boolean; game?: GameSession };
  assert.equal(body.success, true);
  assert.ok(body.game, 'join-game must return a game');
  const q = body.game?.questions[0];
  assert.equal(q?.text, '', 'join-game response to a student must be sanitized');
  assert.equal(q?.correctAnswer, '', 'join-game response must never leak correctAnswer');
});

test('student game-state in ANSWERING hides correctAnswer but keeps the question visible', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const answering = makeGame();
  answering.phase = 'ANSWERING';
  await store.setGame(PIN, answering);
  await store.setTeacherPin('teacher-1', PIN);
  await store.setStudentPin('student-1', PIN);
  await store.setGame(PIN, { ...answering, students: { 'student-1': { id: 'student-1', name: 'Ali', pin: PIN, teamId: null, isLeader: false, connected: true } } });

  const res = await fetch(`${base}/api/game-state?clientId=student-1`);
  const body = (await res.json()) as { success: boolean; game?: GameSession };
  const q = body.game?.questions[0];
  assert.equal(q?.text, QUESTION.text, 'question text stays visible in ANSWERING');
  assert.equal(q?.options?.length, 3, 'options stay visible in ANSWERING');
  assert.equal(q?.correctAnswer, '', 'correctAnswer must still be stripped in ANSWERING');
});

test('teacher can reveal the question (start-answering-phase) even before all teams bet', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  // BETTING game with two teams, neither of which has bet yet.
  const betting = makeGame();
  betting.teams = {
    t1: { id: 't1', name: 'A', color: '#000', score: 100, leaderClientId: null, memberIds: [], currentBet: null, currentAnswer: null, answerSubmittedAt: null, isEliminated: false, lastResult: null },
    t2: { id: 't2', name: 'B', color: '#000', score: 100, leaderClientId: null, memberIds: [], currentBet: null, currentAnswer: null, answerSubmittedAt: null, isEliminated: false, lastResult: null },
  };
  betting.students = {
    'student-1': { id: 'student-1', name: 'Ali', pin: PIN, teamId: 't1', isLeader: true, connected: true },
  };
  await store.setGame(PIN, betting);
  await store.setTeacherPin('teacher-1', PIN);
  await store.setStudentPin('student-1', PIN);
  const teacherToken = await store.createSessionToken('teacher-1');

  // Teacher reveals the question.
  const reveal = await fetch(`${base}/api/start-answering-phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ clientId: 'teacher-1' }),
  });
  const revealBody = (await reveal.json()) as { success: boolean };
  assert.equal(revealBody.success, true, 'reveal must succeed even though no team bet');

  const persisted = await store.getGame(PIN);
  assert.equal(persisted?.phase, 'ANSWERING', 'phase must move to ANSWERING on reveal');

  // Students can now see the question text/options (but not the answer).
  const res = await fetch(`${base}/api/game-state?clientId=student-1`);
  const body = (await res.json()) as { success: boolean; game?: GameSession };
  const q = body.game?.questions[0];
  assert.equal(q?.text, QUESTION.text, 'after reveal students see the question text');
  assert.equal(q?.options?.length, 3, 'after reveal students see the options');
  assert.equal(q?.correctAnswer, '', 'but the correct answer stays hidden in ANSWERING');
});
