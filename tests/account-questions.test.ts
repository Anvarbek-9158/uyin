// Per-account question banks and plan assignment.
//
// Covers: lazy seeding for reserved PRO accounts, empty bank for regular
// accounts, per-account isolation (two different accounts never see each
// other's questions), set-questions persists to the correct account, and the
// 'pro' plan is assigned at signup/login for reserved emails.
//
// Hermetic: in-memory store, no network, all env overrides are set BEFORE any
// module imports.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.LOGIN_ATTEMPT_LIMIT = '3';
process.env.LOGIN_ATTEMPT_WINDOW_MINUTES = '15';
process.env.SIGNUP_ATTEMPT_LIMIT = '1000';

import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_QUESTIONS_BY_EMAIL } from '../src/data/proSeedQuestions.js';
import { DEFAULT_QUESTIONS } from '../src/data/defaultQuestions.js';

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

// All accounts created in these tests are teachers for the console flow. The
// reserved PRO email is fixed, but the in-memory store is shared by every test
// in this file, so once it exists the second test logs in instead of re-signing.
async function signupAccount(
  base: string,
  email: string,
  password = 'Str0ng-pass!'
): Promise<{ token: string; user: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Teacher', email, password, role: 'teacher' }),
  });
  const data = (await res.json()) as {
    success: boolean;
    token: string;
    user: Record<string, unknown>;
  };
  if (res.status === 409 || !data.success) {
    return loginAccount(base, email, password);
  }
  return { token: data.token, user: data.user };
}

async function loginAccount(
  base: string,
  email: string,
  password = 'Str0ng-pass!'
): Promise<{ token: string; user: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role: 'teacher' }),
  });
  const data = (await res.json()) as {
    success: boolean;
    token: string;
    user: Record<string, unknown>;
  };
  return { token: data.token, user: data.user };
}

// POST with per-account (x-auth-token) and per-game session auth.
async function postWithAccount(
  base: string,
  path: string,
  body: Record<string, unknown>,
  accountToken?: string | null,
  sessionToken?: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accountToken ? { 'x-auth-token': accountToken } : {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// --- Plan assignment -----------------------------------------------------------

test('PLAN: pro email is assigned plan "pro" at signup; normal email gets "free"', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const reservedProEmail = 'anvarbekomonov8@gmail.com';
  const normalEmail = `plannorm-${Date.now()}@other.test`;

  const pro = await signupAccount(base, reservedProEmail);
  assert.equal(pro.user.plan, 'pro', 'reserved pro email must get plan "pro" at signup');
  assert.equal(pro.user.role, 'teacher');

  const normal = await signupAccount(base, normalEmail);
  assert.equal(normal.user.plan, 'free', 'non-reserved email must default to plan "free"');

  // /me must preserve the plan attached to the session.
  const meRes = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${pro.token}` },
  });
  const meBody = (await meRes.json()) as { success: boolean; user: Record<string, unknown> };
  assert.equal(meBody.success, true);
  assert.equal(meBody.user.plan, 'pro', '/me must reflect the pro plan');

  // Re-login to check the plan survives the login path.
  const proLogin = await loginAccount(base, reservedProEmail);
  assert.equal(proLogin.user.plan, 'pro', 'login must return the pro plan');
  assert.equal(proLogin.user.email, reservedProEmail);

  const normalLogin = await loginAccount(base, normalEmail);
  assert.equal(normalLogin.user.plan, 'free', 'non-reserved login must stay "free"');
});

// --- Question bank seeding and isolation -------------------------------------------

test('BANK: pro account is seeded with the full starter set; non-pro starts empty', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const reservedProEmail = 'anvarbekomonov8@gmail.com';
  const otherEmail = `bank-other-${Date.now()}@other.test`;

  const pro = await signupAccount(base, reservedProEmail);
  const other = await signupAccount(base, otherEmail);

  // --- Pro account: create-game seeds 15 questions (8 defaults + 7 new) ------
  const proClientId = `c_pro_${Date.now()}`;
  const created = await postWithAccount(base, '/api/create-game', { clientId: proClientId }, pro.token);
  assert.equal(created.body.success, true, 'pro create-game must succeed');
  const proGame = created.body.game as { questions?: unknown[] } | undefined;
  assert.ok(proGame?.questions, 'pro game must have questions');
  const expectedCount = DEFAULT_QUESTIONS.length + 7; // 8 + 7 = 15
  assert.equal(
    proGame!.questions!.length,
    expectedCount,
    `pro bank must be seeded with ${expectedCount} questions`
  );

  // --- Non-pro account: create-game starts with an empty bank -------------------
  const otherClientId = `c_other_${Date.now()}`;
  const otherCreated = await postWithAccount(base, '/api/create-game', { clientId: otherClientId }, other.token);
  assert.equal(otherCreated.body.success, true);
  const otherGame = otherCreated.body.game as { questions?: unknown[] } | undefined;
  assert.equal(
    otherGame!.questions!.length,
    0,
    'non-pro account must start with an empty question bank'
  );
});

test('BANK: set-questions persists to the account that owns it; another account is unaffected', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const emailA = `iso-a-${Date.now()}@a.test`;
  const emailB = `iso-b-${Date.now()}@b.test`;
  const tokenA = (await signupAccount(base, emailA)).token;
  const tokenB = (await signupAccount(base, emailB)).token;

  // --- Account A creates a game and adds 2 questions --------------------------
  const clientIdA = `iso_a_${Date.now()}`;
  const createdA = await postWithAccount(base, '/api/create-game', { clientId: clientIdA }, tokenA);
  const sessionTokenA = (createdA.body.sessionToken as string) ?? null;

  const bankA = [
    { id: 'iso_q1', text: 'Q1?', correctAnswer: 'yes', timeLimit: 20, options: ['yes', 'no'] },
    { id: 'iso_q2', text: 'Q2?', correctAnswer: '1', timeLimit: 25, options: ['1', '2'] },
  ];
  const sqA = await postWithAccount(
    base,
    '/api/set-questions',
    { clientId: clientIdA, questions: bankA },
    tokenA,
    sessionTokenA
  );
  assert.equal(sqA.body.success, true, 'set-questions for account A must succeed');

  // --- Account A starts a NEW game: its questions carry over ------------------
  const clientIdA2 = `iso_a2_${Date.now()}`;
  const a2Created = await postWithAccount(base, '/api/create-game', { clientId: clientIdA2 }, tokenA);
  const a2Game = a2Created.body.game as { questions?: unknown[] };
  assert.equal(a2Game?.questions?.length, 2, 'second game for account A must carry over the 2 questions');
  assert.deepEqual(
    (a2Game!.questions![0] as { id: string }).id,
    'iso_q1',
    'first question id preserved after persist + reload'
  );

  // --- Account B creates a game: must NOT see A's questions --------------------
  const clientIdB = `iso_b_${Date.now()}`;
  const bCreated = await postWithAccount(base, '/api/create-game', { clientId: clientIdB }, tokenB);
  const bGame = bCreated.body.game as { questions?: unknown[] };
  assert.equal(
    bGame?.questions?.length,
    0,
    'account B must NOT see account A\'s questions (isolation)'
  );

  // --- B adds its own question; A is unaffected --------------------------------
  const bankB = [
    { id: 'b_only', text: 'B?', correctAnswer: 'x', timeLimit: 20, options: ['x', 'y'] },
  ];
  const createdB = await postWithAccount(base, '/api/create-game', { clientId: clientIdB }, tokenB);
  const sessionTokenB = (createdB.body.sessionToken as string) ?? null;
  await postWithAccount(
    base,
    '/api/set-questions',
    { clientId: clientIdB, questions: bankB },
    tokenB,
    sessionTokenB
  );

  const clientIdA3 = `iso_a3_${Date.now()}`;
  const a3Created = await postWithAccount(base, '/api/create-game', { clientId: clientIdA3 }, tokenA);
  const a3Game = a3Created.body.game as { questions?: unknown[] };
  assert.equal(a3Game?.questions?.length, 2, 'account A still has only its own 2 questions');
  assert.deepEqual(
    (a3Game!.questions![0] as { id: string }).id,
    'iso_q1',
    'account A questions unaffected by B saving its own'
  );
});

test('BANK: without an account token create-game falls back to the shared (global) bank', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  // Anonymous create-game (no x-auth-token): unit test / legacy path.
  const clientId = `anon_${Date.now()}`;
  const res = await fetch(`${base}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
  const data = (await res.json()) as { success: boolean; game?: { questions?: unknown[] } };
  assert.equal(data.success, true);
  // The global bank is whatever loadQuestions() returns: DEFAULT_QUESTIONS (8)
  // if questions_db.json has 5 which overrides; either way > 0.
  assert.ok(
    (data.game?.questions?.length ?? 0) > 0,
    'anonymous caller must still get the shared (non-empty) question bank'
  );
});
