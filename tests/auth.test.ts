// Real account auth (email + password) tests.
//
// Covers: signup validation + persistence, duplicate-email rejection, login
// (success / wrong password / unknown email / role mismatch), /api/auth/me,
// logout revocation, password hashing internals, and login/signup rate limits.
//
// Hermetic by construction: in-memory store, Pusher triggers fail fast and are
// swallowed, nothing touches the network.
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
import { hashPassword, verifyPassword } from '../src/server/auth.js';

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

async function req(
  method: 'GET' | 'POST',
  base: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const post = (base: string, path: string, body: Record<string, unknown>, token?: string | null) =>
  req('POST', base, path, body, token);
const get = (base: string, path: string, token?: string | null) => req('GET', base, path, undefined, token);

let seq = 0;
const uniqueEmail = (prefix: string) => `t${Date.now()}_${seq++}@${prefix}.test`;

test('PASSWORD: scrypt hashing round-trip, wrong password and tampering are rejected', () => {
  const hash = hashPassword('s3cret-password');
  assert.ok(hash.startsWith('scrypt$'), 'stored format carries the scrypt marker');
  assert.notEqual(hash, 's3cret-password', 'the plaintext password must never be stored');
  assert.ok(verifyPassword('s3cret-password', hash));
  assert.equal(verifyPassword('wrong-password', hash), false);
  assert.equal(verifyPassword('s3cret-password', 'scrypt$00:00'), false);
  assert.equal(verifyPassword('s3cret-password', 'garbage'), false);
});

test('AUTH: signup creates a real account and returns a session token', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('signup');
  const res = await post(base, '/api/auth/signup', {
    name: 'Ali Valiyev',
    email,
    password: 'strong-pass-123',
    role: 'teacher',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const user = res.body.user as Record<string, unknown>;
  assert.equal(user.email, email);
  assert.equal(user.name, 'Ali Valiyev');
  assert.equal(user.role, 'teacher');
  assert.equal('passwordHash' in user, false, 'the password hash must never leave the server');
  assert.equal('password' in user, false);
  assert.ok(typeof user.id === 'string' && (user.id as string).length > 0);
  assert.ok(typeof res.body.token === 'string' && (res.body.token as string).length === 64);
});

test('AUTH: duplicate email is rejected with 409 email_taken', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('duplicate');
  const first = await post(base, '/api/auth/signup', {
    name: 'A',
    email,
    password: 'strong-pass-123',
    role: 'student',
  });
  assert.equal(first.status, 200);

  const second = await post(base, '/api/auth/signup', {
    name: 'B',
    email,
    password: 'other-pass-456',
    role: 'student',
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'email_taken');
});

test('AUTH: signup validates email, password length and role', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const badEmail = await post(base, '/api/auth/signup', {
    name: 'A',
    email: 'not-an-email',
    password: 'strong-pass-123',
    role: 'student',
  });
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.code, 'invalid_email');

  const shortPass = await post(base, '/api/auth/signup', {
    name: 'A',
    email: uniqueEmail('shortpass'),
    password: '1234567',
    role: 'student',
  });
  assert.equal(shortPass.status, 400);
  assert.equal(shortPass.body.code, 'invalid_password');

  const badRole = await post(base, '/api/auth/signup', {
    name: 'A',
    email: uniqueEmail('role'),
    password: 'strong-pass-123',
    role: 'admin',
  });
  assert.equal(badRole.status, 400);
  assert.equal(badRole.body.code, 'invalid_role');

  const noName = await post(base, '/api/auth/signup', {
    name: '   ',
    email: uniqueEmail('noname'),
    password: 'strong-pass-123',
    role: 'student',
  });
  assert.equal(noName.status, 400);
  assert.equal(noName.body.code, 'invalid_name');
});

test('AUTH: login succeeds with correct credentials and returns a session', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('login');
  await post(base, '/api/auth/signup', {
    name: 'Olim',
    email,
    password: 'strong-pass-123',
    role: 'teacher',
  });

  const res = await post(base, '/api/auth/login', { email, password: 'strong-pass-123', role: 'teacher' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const user = res.body.user as Record<string, unknown>;
  assert.equal(user.email, email);
  assert.ok(typeof res.body.token === 'string');
});

test('AUTH: login rejects wrong password and unknown email identically (no enumeration)', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('numerator');
  // A real account exists; the attacker tries the WRONG password on it, plus a
  // completely unknown email. Both responses must be byte-identical.
  await post(base, '/api/auth/signup', {
    name: 'Victim',
    email,
    password: 'strong-pass-123',
    role: 'teacher',
  });

  const badPass = await post(base, '/api/auth/login', { email, password: 'not-the-pass', role: 'teacher' });
  const noAccount = await post(base, '/api/auth/login', {
    email: `ghost_${email}`,
    password: 'not-the-pass',
    role: 'teacher',
  });
  assert.equal(badPass.status, 401);
  assert.equal(noAccount.status, 401);
  assert.equal(badPass.body.code, 'invalid_credentials');
  assert.equal(noAccount.body.code, 'invalid_credentials');
  assert.equal(badPass.body.message, noAccount.body.message, 'messages must not reveal if the email exists');
});

test('AUTH: login rejects a role that does not match the account', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('role');
  await post(base, '/api/auth/signup', {
    name: 'Ustoz',
    email,
    password: 'strong-pass-123',
    role: 'teacher',
  });

  const res = await post(base, '/api/auth/login', { email, password: 'strong-pass-123', role: 'student' });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'role_mismatch');
});

test('AUTH: /api/auth/me resolves the session token', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('me');
  const signup = await post(base, '/api/auth/signup', {
    name: 'Sardor',
    email,
    password: 'strong-pass-123',
    role: 'student',
  });
  const token = signup.body.token as string;

  const me = await get(base, '/api/auth/me', token);
  assert.equal(me.status, 200);
  assert.equal((me.body.user as Record<string, unknown>).email, email);

  const unauthenticated = await get(base, '/api/auth/me');
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.code, 'not_authenticated');

  const garbage = await get(base, '/api/auth/me', 'f'.repeat(64));
  assert.equal(garbage.status, 401);

  const malformed = await get(base, '/api/auth/me', 'not-a-token');
  assert.equal(malformed.status, 401);
});

test('AUTH: logout revokes the session so /me stops working', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('logout');
  const signup = await post(base, '/api/auth/signup', {
    name: 'Media',
    email,
    password: 'strong-pass-123',
    role: 'teacher',
  });
  const token = signup.body.token as string;

  const out = await post(base, '/api/auth/logout', {}, token);
  assert.equal(out.status, 200);
  assert.equal(out.body.success, true);

  const me = await get(base, '/api/auth/me', token);
  assert.equal(me.status, 401, 'the revoked token must not authenticate');
});

test('AUTH: repeated failed logins are rate limited with 429', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const email = uniqueEmail('ratelimit');
  // Signup (an account to "attack"), then blow the budget with wrong passwords.
  await post(base, '/api/auth/signup', {
    name: 'Target',
    email,
    password: 'strong-pass-123',
    role: 'student',
  });

  // SIGNUP_ATTEMPT_LIMIT is 1000/hr in this file, so these signup calls in
  // earlier tests share a single IP bucket but stay far below the limit; only
  // the 429 below matters here.
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = await post(base, '/api/auth/login', {
      email,
      password: 'wrong-pass',
      role: 'student',
    });
    statuses.push(res.status);
  }

  // LOGIN_ATTEMPT_LIMIT = 3: first three are 401, the rest must be 429.
  assert.deepEqual(statuses[0], 401);
  assert.deepEqual(statuses[1], 401);
  assert.deepEqual(statuses[2], 401);
  assert.deepEqual(statuses[3], 429);
  assert.deepEqual(statuses[4], 429);
  assert.deepEqual(statuses[5], 429);
});