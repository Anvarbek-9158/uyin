// Security & functional test suite for the private chat (student <-> teacher).
//
// Hermetic by construction:
//   - in-memory store (no Redis),
//   - Pusher triggers fail fast (unreachable host/port) and are swallowed by
//     emitToGame/emitToChat, so nothing touches the network,
//   - a tiny rate limit (3/60s) is configured below so the tests can exhaust it
//     quickly, and the clock is mocked to verify the window resets.
//
// These env assignments MUST happen before app.ts (which runs `dotenv/config`)
// is imported; dotenv does not overwrite already-set variables.
process.env.NODE_ENV = 'test';
process.env.KV_REST_API_URL = '';
process.env.KV_REST_API_TOKEN = '';
process.env.PUSHER_HOST = '127.0.0.1';
process.env.PUSHER_PORT = '9';
process.env.PUSHER_TIMEOUT = '2000';
process.env.CHAT_RATE_LIMIT_MAX = '3';
process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS = '60';

import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, GameSession } from '../src/types.js';

function makeGame(pin: string, teacherClientId: string): GameSession {
  return {
    pin,
    teacherClientId,
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

async function createGame(
  base: string,
  clientId: string
): Promise<{ pin: string; sessionToken: string }> {
  const res = await fetch(`${base}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
  const body = (await res.json()) as { success: boolean; pin?: string; sessionToken?: string };
  assert.equal(body.success, true);
  assert.ok(body.pin);
  assert.match(body.sessionToken ?? '', /^[0-9a-f]{64}$/, 'create-game must return a session token');
  return { pin: body.pin as string, sessionToken: body.sessionToken as string };
}

async function joinGame(
  base: string,
  clientId: string,
  pin: string,
  name: string
): Promise<{ sessionToken: string }> {
  const res = await fetch(`${base}/api/join-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, pin, name }),
  });
  const body = (await res.json()) as {
    success: boolean;
    studentId?: string;
    sessionToken?: string;
  };
  assert.equal(body.success, true);
  assert.equal(body.studentId, clientId);
  assert.match(body.sessionToken ?? '', /^[0-9a-f]{64}$/, 'join-game must return a session token');
  return { sessionToken: body.sessionToken as string };
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function sendChat(
  base: string,
  body: Record<string, unknown>,
  token: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function getMessages(
  base: string,
  query: Record<string, string>,
  token: string | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${base}/api/chat/messages?${qs}`, { headers: authHeaders(token) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function pusherAuth(
  base: string,
  params: Record<string, string>
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}/api/pusher/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, body: await res.text() };
}

test('create-game and join-game mint a session token for the client', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-t1');
  assert.equal(await store.getSessionToken('teacher-t1'), created.sessionToken);

  const joined = await joinGame(base, 'student-t1', created.pin, 'Ali');
  assert.equal(await store.getSessionToken('student-t1'), joined.sessionToken);

  // Recreating/joining again reuses the same token (stable browser session).
  const createdAgain = await createGame(base, 'teacher-t1');
  assert.equal(createdAgain.sessionToken, created.sessionToken);
});

test('student can send a message to their own chat and it is persisted', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p1');
  const student = await joinGame(base, 'student-p1', created.pin, 'Ali');

  const res = await sendChat(
    base,
    { clientId: 'student-p1', text: 'Assalomu alaykum!' },
    student.sessionToken
  );
  assert.equal(res.status, 200);
  assert.equal((res.body as { success: boolean }).success, true);

  const stored = await store.getChatMessages(created.pin, 'student-p1');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].text, 'Assalomu alaykum!');
  assert.equal(stored[0].senderId, 'student-p1');
  assert.equal(stored[0].role, 'student');
});

test('teacher can send a message to any student', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p2');
  await joinGame(base, 'student-p2', created.pin, 'Ali');

  const res = await sendChat(
    base,
    { clientId: 'teacher-p2', studentId: 'student-p2', text: 'Vaalaykum salom' },
    created.sessionToken
  );
  assert.equal(res.status, 200);
  assert.equal((res.body as { success: boolean }).success, true);

  const stored = await store.getChatMessages(created.pin, 'student-p2');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].senderId, 'teacher-p2');
  assert.equal(stored[0].role, 'teacher');
});

test('teacher and owning student can both read the chat history', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'teacher-p3');
  const student = await joinGame(base, 'student-p3', created.pin, 'Ali');

  await sendChat(
    base,
    { clientId: 'student-p3', text: 'savolim bor' },
    student.sessionToken
  );
  await sendChat(
    base,
    { clientId: 'teacher-p3', studentId: 'student-p3', text: 'marhamat' },
    created.sessionToken
  );

  const asTeacher = await getMessages(
    base,
    { pin: created.pin, clientId: 'teacher-p3', studentId: 'student-p3' },
    created.sessionToken
  );
  assert.equal(asTeacher.status, 200);
  assert.equal((asTeacher.body as { success: boolean }).success, true);
  const teacherMsgs = (asTeacher.body as { messages: ChatMessage[] }).messages;
  assert.equal(teacherMsgs.length, 2);
  assert.deepEqual(
    teacherMsgs.map((m) => m.text).sort(),
    ['marhamat', 'savolim bor']
  );

  const asStudent = await getMessages(
    base,
    { pin: created.pin, clientId: 'student-p3', studentId: 'student-p3' },
    student.sessionToken
  );
  assert.equal(asStudent.status, 200);
  assert.equal((asStudent.body as { success: boolean }).success, true);
  assert.equal((asStudent.body as { messages: ChatMessage[] }).messages.length, 2);
});

// ------------------------------------------------------------
// Security: negative scenarios (all MUST be rejected)
// ------------------------------------------------------------

test('SECURITY: student A cannot write into student B chat', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p4');
  const studentA = await joinGame(base, 'student-p4a', created.pin, 'Ali');
  await joinGame(base, 'student-p4b', created.pin, 'Bob');

  const res = await sendChat(
    base,
    { clientId: 'student-p4a', studentId: 'student-p4b', text: 'hack' },
    studentA.sessionToken
  );
  assert.equal(res.status, 403, 'foreign chat write must be rejected');
  assert.equal((res.body as { success: boolean }).success, false);

  const bChat = await store.getChatMessages(created.pin, 'student-p4b');
  assert.equal(bChat.length, 0, 'nothing may be written into B chat');
  const aChat = await store.getChatMessages(created.pin, 'student-p4a');
  assert.equal(aChat.length, 0, 'nothing may be written at all');
});

test('SECURITY: student A cannot read student B chat history', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'teacher-p5');
  const studentA = await joinGame(base, 'student-p5a', created.pin, 'Ali');
  const studentB = await joinGame(base, 'student-p5b', created.pin, 'Bob');

  await sendChat(
    base,
    { clientId: 'student-p5b', text: 'maxfiy' },
    studentB.sessionToken
  );

  const res = await getMessages(
    base,
    { pin: created.pin, clientId: 'student-p5a', studentId: 'student-p5b' },
    studentA.sessionToken
  );
  assert.equal(res.status, 403, 'foreign chat read must be rejected');
  assert.equal((res.body as { success: boolean }).success, false);
});

test('SECURITY: teacher of another game cannot read/send to this game chat', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p6');
  await joinGame(base, 'student-p6', created.pin, 'Ali');
  const other = await createGame(base, 'teacher-other');

  // Read: the other teacher must not see this game's chat.
  const read = await getMessages(
    base,
    { pin: created.pin, clientId: 'teacher-other', studentId: 'student-p6' },
    other.sessionToken
  );
  assert.equal(read.status, 403, 'foreign teacher chat read must be rejected');

  // Write: must not land in this game's chat.
  const write = await sendChat(
    base,
    { clientId: 'teacher-other', studentId: 'student-p6', text: 'buzmoqchi' },
    other.sessionToken
  );
  assert.equal((write.body as { success: boolean }).success, false);
  assert.equal((await store.getChatMessages(created.pin, 'student-p6')).length, 0);
});

test('SECURITY: empty or unregistered clientId is rejected on all chat endpoints', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'teacher-p7');
  await joinGame(base, 'student-p7', created.pin, 'Ali');

  // Empty clientId.
  const emptySend = await sendChat(base, { clientId: '', text: 'x' }, null);
  assert.ok(emptySend.status === 400 || !(emptySend.body as { success: boolean }).success);
  const emptyRead = await getMessages(
    base,
    { pin: created.pin, clientId: '', studentId: 'student-p7' },
    null
  );
  assert.ok(emptyRead.status === 400 || !(emptyRead.body as { success: boolean }).success);

  // Unregistered clientId (never created a game / joined one).
  const ghostSend = await sendChat(base, { clientId: 'ghost-client', text: 'x' }, null);
  assert.equal(ghostSend.status, 401, 'unregistered client must be rejected');
  const ghostRead = await getMessages(
    base,
    { pin: created.pin, clientId: 'ghost-client', studentId: 'student-p7' },
    null
  );
  assert.equal(ghostRead.status, 401, 'unregistered client must be rejected');

  const ghostAuth = await pusherAuth(base, {
    socket_id: '1.2',
    channel_name: `private-chat-${created.pin}-student-p7`,
    clientId: 'ghost-client',
  });
  assert.equal(ghostAuth.status, 401);
});

test('SECURITY: wrong or missing session token is rejected', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p8');
  await joinGame(base, 'student-p8', created.pin, 'Ali');

  // Wrong token.
  const wrong = await sendChat(
    base,
    { clientId: 'student-p8', text: 'x' },
    'a'.repeat(64)
  );
  assert.equal(wrong.status, 401, 'wrong token must be rejected');
  assert.equal((await store.getChatMessages(created.pin, 'student-p8')).length, 0);

  // Missing token (client HAS a stored token, so legacy path does not apply).
  const missing = await sendChat(base, { clientId: 'student-p8', text: 'x' }, null);
  assert.equal(missing.status, 401, 'missing token must be rejected');

  // Malformed token format.
  const malformed = await sendChat(
    base,
    { clientId: 'student-p8', text: 'x' },
    'not-a-real-token'
  );
  assert.equal(malformed.status, 401, 'malformed token must be rejected');
});

test('SECURITY: student cannot subscribe to another student private channel via pusher/auth', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'teacher-p9');
  const studentA = await joinGame(base, 'student-p9a', created.pin, 'Ali');
  await joinGame(base, 'student-p9b', created.pin, 'Bob');

  // Own channel: allowed.
  const own = await pusherAuth(base, {
    socket_id: '1.2',
    channel_name: `private-chat-${created.pin}-student-p9a`,
    clientId: 'student-p9a',
    sessionToken: studentA.sessionToken,
  });
  assert.equal(own.status, 200, 'own channel must be authorized');
  assert.ok(own.body.includes('"auth"'), 'auth response must contain the auth signature');

  // Someone else's channel: forbidden.
  const foreign = await pusherAuth(base, {
    socket_id: '1.2',
    channel_name: `private-chat-${created.pin}-student-p9b`,
    clientId: 'student-p9a',
    sessionToken: studentA.sessionToken,
  });
  assert.equal(foreign.status, 403, 'foreign channel must be rejected');

  // Missing token: rejected.
  const noToken = await pusherAuth(base, {
    socket_id: '1.2',
    channel_name: `private-chat-${created.pin}-student-p9a`,
    clientId: 'student-p9a',
  });
  assert.equal(noToken.status, 401, 'missing token on pusher auth must be rejected');
});

test('EDGE: pusher/auth rejects a malformed socket_id with 400 instead of 500', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'teacher-p9x');
  const studentA = await joinGame(base, 'student-p9x', created.pin, 'Ali');

  const res = await pusherAuth(base, {
    socket_id: '1.2.3',
    channel_name: `private-chat-${created.pin}-student-p9x`,
    clientId: 'student-p9x',
    sessionToken: studentA.sessionToken,
  });
  assert.equal(res.status, 400, 'malformed socket_id must be rejected with 400');
});

// ------------------------------------------------------------
// Rate limiting
// ------------------------------------------------------------

test('RATE LIMIT: a client is limited after too many messages, then allowed again after the window', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const realNow = Date.now;
  let fakeNow = 10_000_000;
  Date.now = () => fakeNow;
  try {
    const created = await createGame(base, 'teacher-p10');
    const student = await joinGame(base, 'student-p10', created.pin, 'Ali');

    // Limit is 3 per window: the first three go through.
    for (let i = 0; i < 3; i++) {
      const res = await sendChat(
        base,
        { clientId: 'student-p10', text: `xabar ${i}` },
        student.sessionToken
      );
      assert.equal(res.status, 200, `message ${i} must be allowed`);
    }

    // Fourth message inside the same window is rejected with 429.
    const blocked = await sendChat(
      base,
      { clientId: 'student-p10', text: 'to\'rtinchi' },
      student.sessionToken
    );
    assert.equal(blocked.status, 429, 'over-limit message must get HTTP 429');
    assert.equal(
      (blocked.body as { success: boolean }).success,
      false,
      'over-limit message must be unsuccessful'
    );
    assert.ok((blocked.body as { retryAfterMs?: number }).retryAfterMs > 0);
    assert.equal((await store.getChatMessages(created.pin, 'student-p10')).length, 3);

    // Window expires: the next message is allowed again.
    fakeNow += 61_000;
    const afterWindow = await sendChat(
      base,
      { clientId: 'student-p10', text: 'yangi oyna' },
      student.sessionToken
    );
    assert.equal(afterWindow.status, 200, 'after the window a message must be allowed');
    assert.equal((await store.getChatMessages(created.pin, 'student-p10')).length, 4);
  } finally {
    Date.now = realNow;
  }
});

// ------------------------------------------------------------
// Edge cases
// ------------------------------------------------------------

test('EDGE: text longer than 1000 chars is truncated by the backend', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p11');
  const student = await joinGame(base, 'student-p11', created.pin, 'Ali');

  const longText = 'a'.repeat(2500);
  const res = await sendChat(
    base,
    { clientId: 'student-p11', text: longText },
    student.sessionToken
  );
  assert.equal(res.status, 200);
  const stored = await store.getChatMessages(created.pin, 'student-p11');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].text.length, 1000, 'message must be truncated to 1000 chars');
});

test('EDGE: empty or whitespace-only text is rejected', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p12');
  const student = await joinGame(base, 'student-p12', created.pin, 'Ali');

  for (const text of ['', '   ', '\t\n']) {
    const res = await sendChat(base, { clientId: 'student-p12', text }, student.sessionToken);
    assert.equal(res.status, 200);
    assert.equal((res.body as { success: boolean }).success, false, `text ${JSON.stringify(text)} must be rejected`);
  }
  assert.equal((await store.getChatMessages(created.pin, 'student-p12')).length, 0);
});

test('EDGE: teacher cannot send to a student who is not in the game', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'teacher-p13');

  const res = await sendChat(
    base,
    { clientId: 'teacher-p13', studentId: 'no-such-student', text: 'senga' },
    created.sessionToken
  );
  assert.equal(res.status, 200);
  assert.equal((res.body as { success: boolean }).success, false);
  assert.equal((await store.getChatMessages(created.pin, 'no-such-student')).length, 0);
});

test('BACKWARD COMPAT: legacy clientId without token is allowed only during grace and only if registered', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  // A legacy-format clientId that IS registered in the store (teacher pin set)
  // but has no session token on record.
  const legacyId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const pin = '777888';
  await store.setGame(pin, makeGame(pin, legacyId));
  await store.setTeacherPin(legacyId, pin);

  const legacyRes = await sendChat(
    base,
    { clientId: legacyId, studentId: 'x', text: 'eski brauzer' },
    null
  );
  // No student 'x' exists yet -> the request is valid auth-wise (legacy allowed)
  // but rejected for the target; this proves the legacy path was NOT a 401.
  assert.notEqual(legacyRes.status, 401, 'registered legacy client must not be rejected by auth');

  // A legacy-FORMAT clientId that is NOT registered anywhere must be rejected.
  const unknownLegacy = await sendChat(
    base,
    { clientId: '00000000-0000-4000-8000-000000000000', text: 'kimdur' },
    null
  );
  assert.equal(unknownLegacy.status, 401, 'unregistered legacy-format client must be rejected');
});

// ------------------------------------------------------------
// Group chat: students are isolated to their OWN group room
// (groups = teams). The teacher may read/write every group room.
// ------------------------------------------------------------

async function createTeam(
  base: string,
  teacherClientId: string,
  pin: string,
  name: string
): Promise<string> {
  const res = await fetch(`${base}/api/create-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: teacherClientId, name }),
  });
  assert.equal(((await res.json()) as { success: boolean }).success, true, 'create-team must work');
  const store = await import('../src/server/state.js');
  const game = await store.getGame(pin);
  assert.ok(game, 'game must exist after team creation');
  const team = Object.values(game.teams).find((t) => t.name === name);
  assert.ok(team, `team "${name}" must exist`);
  return team.id;
}

async function assignToTeam(
  base: string,
  teacherClientId: string,
  studentId: string,
  teamId: string
): Promise<void> {
  const res = await fetch(`${base}/api/assign-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: teacherClientId, studentId, teamId }),
  });
  assert.equal(((await res.json()) as { success: boolean }).success, true, 'assign-student must work');
}

test('GROUP: members of the same group can chat and each member + the teacher can read it', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'gteacher-p1');
  const studentA = await joinGame(base, 'gstudent-p1a', created.pin, 'Ali');
  const studentB = await joinGame(base, 'gstudent-p1b', created.pin, 'Bob');
  const teamId = await createTeam(base, 'gteacher-p1', created.pin, 'Lochinlar');
  await assignToTeam(base, 'gteacher-p1', 'gstudent-p1a', teamId);
  await assignToTeam(base, 'gteacher-p1', 'gstudent-p1b', teamId);

  // Student A posts into the group room.
  const sent = await sendChat(
    base,
    { clientId: 'gstudent-p1a', text: 'salom guruh', roomType: 'group', teamId },
    studentA.sessionToken
  );
  assert.equal(sent.status, 200, 'member of the group can send');
  assert.equal((sent.body as { success: boolean }).success, true);
  const msg = (sent.body as { message?: ChatMessage }).message;
  assert.equal(msg?.roomType, 'group');
  assert.equal(msg?.groupId, teamId);

  // Stored under the group room key, not a private key.
  const stored = await store.getChatMessages(created.pin, `g:${teamId}`);
  assert.equal(stored.length, 1);
  assert.equal((await store.getChatMessages(created.pin, 'gstudent-p1a')).length, 0);

  // The other member reads it.
  const asMemberB = await getMessages(
    base,
    { pin: created.pin, clientId: 'gstudent-p1b', roomType: 'group', teamId },
    studentB.sessionToken
  );
  assert.equal(asMemberB.status, 200);
  assert.equal((asMemberB.body as { messages: ChatMessage[] }).messages.length, 1);

  // The teacher reads it too.
  const asTeacher = await getMessages(
    base,
    { pin: created.pin, clientId: 'gteacher-p1', roomType: 'group', teamId },
    created.sessionToken
  );
  assert.equal(asTeacher.status, 200);
  assert.equal((asTeacher.body as { messages: ChatMessage[] }).messages.length, 1);
  assert.equal((asTeacher.body as { messages: ChatMessage[] }).messages[0].text, 'salom guruh');
});

test('SECURITY: a student cannot write into another group room', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'gteacher-p2');
  const studentA = await joinGame(base, 'gstudent-p2a', created.pin, 'Ali');
  await joinGame(base, 'gstudent-p2b', created.pin, 'Bob');
  const team1 = await createTeam(base, 'gteacher-p2', created.pin, 'Lochinlar');
  const team2 = await createTeam(base, 'gteacher-p2', created.pin, 'Zukkolar');
  await assignToTeam(base, 'gteacher-p2', 'gstudent-p2a', team1);
  await assignToTeam(base, 'gteacher-p2', 'gstudent-p2b', team2);

  const res = await sendChat(
    base,
    { clientId: 'gstudent-p2a', text: 'buzmoqchi', roomType: 'group', teamId: team2 },
    studentA.sessionToken
  );
  assert.equal(res.status, 403, 'cross-group write must be rejected');
  assert.equal((await store.getChatMessages(created.pin, `g:${team2}`)).length, 0);

  // Even an invalid/non-existent teamId must be rejected for a student.
  const bogus = await sendChat(
    base,
    { clientId: 'gstudent-p2a', text: 'nima', roomType: 'group', teamId: 'team_no_such' },
    studentA.sessionToken
  );
  assert.equal(bogus.status, 403);
});

test('SECURITY: a student cannot read another group room history', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'gteacher-p3');
  const studentA = await joinGame(base, 'gstudent-p3a', created.pin, 'Ali');
  const studentB = await joinGame(base, 'gstudent-p3b', created.pin, 'Bob');
  const team1 = await createTeam(base, 'gteacher-p3', created.pin, 'Lochinlar');
  const team2 = await createTeam(base, 'gteacher-p3', created.pin, 'Zukkolar');
  await assignToTeam(base, 'gteacher-p3', 'gstudent-p3a', team1);
  await assignToTeam(base, 'gteacher-p3', 'gstudent-p3b', team2);

  await sendChat(
    base,
    { clientId: 'gstudent-p3b', text: 'maxfiy', roomType: 'group', teamId: team2 },
    studentB.sessionToken
  );

  const res = await getMessages(
    base,
    { pin: created.pin, clientId: 'gstudent-p3a', roomType: 'group', teamId: team2 },
    studentA.sessionToken
  );
  assert.equal(res.status, 403, 'cross-group read must be rejected');
});

test('SECURITY: an unassigned student cannot write to or read any group room', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const store = await import('../src/server/state.js');

  const created = await createGame(base, 'gteacher-p4');
  const unassigned = await joinGame(base, 'gstudent-p4c', created.pin, 'Qobil');
  const team1 = await createTeam(base, 'gteacher-p4', created.pin, 'Lochinlar');

  const write = await sendChat(
    base,
    { clientId: 'gstudent-p4c', text: 'kirib kelaman', roomType: 'group', teamId: team1 },
    unassigned.sessionToken
  );
  assert.equal(write.status, 403, 'unassigned student write must be rejected');
  assert.equal((await store.getChatMessages(created.pin, `g:${team1}`)).length, 0);

  const read = await getMessages(
    base,
    { pin: created.pin, clientId: 'gstudent-p4c', roomType: 'group', teamId: team1 },
    unassigned.sessionToken
  );
  assert.equal(read.status, 403, 'unassigned student read must be rejected');
});

test('GROUP: teacher can read and write every group room (bypass)', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'gteacher-p5');
  const team1 = await createTeam(base, 'gteacher-p5', created.pin, 'Lochinlar');
  const team2 = await createTeam(base, 'gteacher-p5', created.pin, 'Zukkolar');

  const to1 = await sendChat(
    base,
    { clientId: 'gteacher-p5', text: '1-guruhga', roomType: 'group', teamId: team1 },
    created.sessionToken
  );
  assert.equal((to1.body as { success: boolean }).success, true);

  const to2 = await sendChat(
    base,
    { clientId: 'gteacher-p5', text: '2-guruhga', roomType: 'group', teamId: team2 },
    created.sessionToken
  );
  assert.equal((to2.body as { success: boolean }).success, true);

  const read2 = await getMessages(
    base,
    { pin: created.pin, clientId: 'gteacher-p5', roomType: 'group', teamId: team2 },
    created.sessionToken
  );
  assert.equal(read2.status, 200);
  assert.equal((read2.body as { messages: ChatMessage[] }).messages.length, 1);
  assert.equal((read2.body as { messages: ChatMessage[] }).messages[0].text, '2-guruhga');

  // A teacher cannot write to a team that does not exist in their game.
  const bogus = await sendChat(
    base,
    { clientId: 'gteacher-p5', text: 'x', roomType: 'group', teamId: 'team_no_such' },
    created.sessionToken
  );
  assert.equal((bogus.body as { success: boolean }).success, false);
});

test('SECURITY: student can only subscribe to their own group channel via pusher/auth', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  const created = await createGame(base, 'gteacher-p6');
  const studentA = await joinGame(base, 'gstudent-p6a', created.pin, 'Ali');
  const studentB = await joinGame(base, 'gstudent-p6b', created.pin, 'Bob');
  const team1 = await createTeam(base, 'gteacher-p6', created.pin, 'Lochinlar');
  const team2 = await createTeam(base, 'gteacher-p6', created.pin, 'Zukkolar');
  await assignToTeam(base, 'gteacher-p6', 'gstudent-p6a', team1);
  await assignToTeam(base, 'gteacher-p6', 'gstudent-p6b', team2);

  const channelOwn = `private-chat-${created.pin}-g-${team1}`;
  const channelOther = `private-chat-${created.pin}-g-${team2}`;

  const own = await pusherAuth(base, {
    clientId: 'gstudent-p6a',
    sessionToken: studentA.sessionToken,
    channel_name: channelOwn,
    socket_id: '123.456',
  });
  assert.equal(own.status, 200, 'own group channel must be authorized');

  const other = await pusherAuth(base, {
    clientId: 'gstudent-p6a',
    sessionToken: studentA.sessionToken,
    channel_name: channelOther,
    socket_id: '123.456',
  });
  assert.equal(other.status, 403, 'foreign group channel must be rejected');

  // The teacher may subscribe to every group channel of their game.
  const asTeacher = await pusherAuth(base, {
    clientId: 'gteacher-p6',
    sessionToken: created.sessionToken,
    channel_name: channelOther,
    socket_id: '123.456',
  });
  assert.equal(asTeacher.status, 200, 'teacher bypass must be authorized');

  // An unassigned student cannot subscribe to any group channel.
  const unassigned = await joinGame(base, 'gstudent-p6c', created.pin, 'Qobil');
  const asUnassigned = await pusherAuth(base, {
    clientId: 'gstudent-p6c',
    sessionToken: unassigned.sessionToken,
    channel_name: channelOwn,
    socket_id: '123.456',
  });
  assert.equal(asUnassigned.status, 403, 'unassigned student group subscribe must be rejected');
});
