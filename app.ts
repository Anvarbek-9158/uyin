import 'dotenv/config';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import type { Request, Response } from 'express';
import Pusher from 'pusher';
import {
  GameSession,
  Question,
  Student,
  Team,
} from './src/types.js';
import * as store from './src/server/state.js';
import {
  applyPresenceSweep,
  questionsPerRound,
} from './src/server/presence.js';
import {
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  CREATE_GAME_LIMIT,
  CREATE_GAME_WINDOW_MS,
  JOIN_ATTEMPT_LIMIT,
  JOIN_ATTEMPT_WINDOW_MS,
  PIN_LIFETIME_MS,
  clientIp,
  isPinExpired,
  requireTeacherAuth,
  respondAuthError,
  verifyChatClient,
} from './src/server/security.js';

const app = express();

// Security headers: sensible defaults from helmet (X-Frame-Options,
// X-Content-Type-Options, referrer policy, HSTS, etc.). In PRODUCTION we also
// set an explicit Content-Security-Policy. No inline scripts are used in the
// production bundle: the anti-FOUC theme snippet lives in /theme-init.js
// (public/, same-origin), so script-src stays strictly 'self' — the strongest
// position that blocks injected/inline script execution. style-src keeps
// 'unsafe-inline' because the UI sets inline `style` attributes (dynamic team
// colors and Tailwind utilities) at runtime. connect-src allows same-origin
// API calls plus the Pusher realtime endpoints.
//
// In development the strict policy is disabled: the Vite dev server injects an
// inline Fast-Refresh preamble and style modules into index.html, which a
// `script-src 'self'` policy would block (breaking HMR). The e2e suite runs
// against the dev server, so a dedicated unit test asserts the production CSP
// header instead (tests/security.test.ts).
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: [
                "'self'",
                'wss://ws-ap2.pusher.com',
                'wss://ws.pusherapp.com',
                'https://sockjs-ap2.pusher.com',
                'http://sockjs-ap2.pusher.com',
                'https://sockjs.pusherapp.com',
                'http://sockjs.pusherapp.com',
              ],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
  })
);

// Same-origin deployment (Express serves dist/, Vercel CDN serves dist/ too), so
// browsers never make cross-origin requests. To be safe against cross-origin
// callers we keep a strict allowlist: only origins listed in CORS_ORIGINS
// (comma-separated) are echoed back. When none are configured, cross-origin
// requests carry no Access-Control-Allow-Origin header (default-deny), but the
// same-origin UI (no Origin header) is unaffected.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

app.use(
  cors({
    origin: (origin, callback) => {
      // Undefined origin = same-origin / non-browser request: never blocked.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, false);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

app.use(express.json());
// pusher-js POSTs auth requests as application/x-www-form-urlencoded (it is not
// a JSON client), so both parsers must be mounted for /api/pusher/auth to work.
app.use(express.urlencoded({ extended: true }));

// Vercel serverless functions run on an ephemeral, read-only filesystem and are
// bundled into a lambda. All persistent game state is kept in Redis (Vercel KV
// / Upstash) when KV_REST_API_* env vars are present; otherwise an in-memory
// store is used for local development. Static file serving is handled by
// Vercel's CDN (see vercel.json); see the guard at the bottom of this file.
const IS_VERCEL = process.env.VERCEL === '1';

// Pusher Channels instance.
//
// All Pusher credentials MUST come from the environment. There are no
// hardcoded fallbacks: a hardcoded secret would be the same value on every
// deploy and, if it ever leaked into git history, would let anyone act as this
// application on Pusher. If any credential is missing the app fails fast at
// boot with a clear message instead of silently running with a broken/missing
// value.
//
// PUSHER_HOST/PUSHER_PORT/PUSHER_TIMEOUT are optional overrides (self-hosted
// Channels-compatible servers, or fast-fail local testing).
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `PUSHER "${name}" env o'zgaruvchisi topilmadi. Iltimos, .env faylni tekshiring ` +
        `va Pusher Channels ma'lumotlarini to'g'ri kiriting.`
    );
  }
  return value;
}

// Pusher only needs the app/key/secret/cluster set at boot. We call requireEnv
// for each required credential so a missing one surfaces instantly, even when
// the app runs in a context where other keys (e.g. KV) are optional.
requireEnv('PUSHER_APP_ID');
requireEnv('PUSHER_KEY');
requireEnv('PUSHER_SECRET');
requireEnv('PUSHER_CLUSTER');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  cluster: process.env.PUSHER_CLUSTER as string,
  ...(process.env.PUSHER_HOST ? { host: process.env.PUSHER_HOST } : {}),
  ...(process.env.PUSHER_PORT ? { port: Number(process.env.PUSHER_PORT) } : {}),
  ...(process.env.PUSHER_TIMEOUT ? { timeout: Number(process.env.PUSHER_TIMEOUT) } : {}),
});

// Team Colors Palette for visual appealing UI
const TEAM_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

// Async route wrapper: catches errors from async handlers and answers JSON
// instead of letting the promise reject silently.
function ah(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error('API xatosi:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Serverda kutilmagan xatolik yuz berdi' });
      }
    });
  };
}

// Helper: Trigger an event on a game channel via Pusher. The returned promise
// resolves only after Pusher confirms the event was accepted, so callers can
// await it (e.g. before sending the HTTP response) and never lose an event when
// a serverless lambda is frozen right after the response is returned.
function emitToGame(pin: string, event: string, data: unknown): Promise<void> {
  return pusher
    .trigger(`game-${pin}`, event, data)
    .then(() => undefined)
    .catch((err) => {
      console.error(`Pusher trigger error (${event} -> ${pin}):`, err);
    });
}

// Build a STUDENT-SAFE copy of the game state that can safely leave the server
// and be broadcast to (or pulled by) a student's browser.
//
// Security: hiding the question/answer with CSS alone is not enough — a student
// could read the raw game_state payload in devtools. The sensitive fields are
// physically removed here:
//   - `correctAnswer` is ALWAYS stripped from every question (the whole question
//     bank with answers must never cross the wire to a student), EXCEPT it is
//     revealed for the CURRENT question once grading has started so students can
//     see the correct answer alongside their result.
//   - In BETTING the CURRENT question's text and options are hidden too (a
//     placeholder keeps index/length so the UI still numbers the question), so a
//     student who is still betting cannot learn the question before it is
//     officially revealed in ANSWERING.
// Teachers are served the FULL state (via the teacher-private channel and the
// role-filtered REST endpoints), never this helper.
function buildStudentSafeGameState(game: GameSession): GameSession {
  const qi = game.currentQuestionIndex || 0;
  const revealed =
    game.phase === 'GRADING' ||
    game.phase === 'ROUND_RESULT' ||
    game.phase === 'GAME_OVER';

  const safeQuestions = game.questions.map((q, idx) => {
    const revealAnswer = revealed && idx === qi;
    return { ...q, correctAnswer: revealAnswer ? q.correctAnswer : '' };
  });

  const safe: GameSession = { ...game, questions: safeQuestions };

  if (game.phase === 'BETTING' && safe.questions[qi]) {
    safe.questions[qi] = { ...safe.questions[qi], text: '', options: [] };
  }
  return safe;
}

// Helper: Trigger the full game state on the teacher-private channel for this
// game. The teacher subscribes to `private-teacher-<pin>` and receives the FULL
// (unsanitized) state so they always see the question, the correct answer and
// every team's answer — unlike students, who only ever get the sanitized state
// on the shared `game-<pin>` channel.
function emitToTeacherGame(pin: string, game: GameSession): Promise<void> {
  return pusher
    .trigger(`private-teacher-${pin}`, 'game_state', game)
    .then(() => undefined)
    .catch((err) => {
      console.error(`Pusher trigger error (teacher state -> ${pin}):`, err);
    });
}

// Relay the countdown second to the teacher-private channel so the teacher's
// live countdown display (which mirrors gameState.timerSeconds) stays in sync,
// now that the teacher no longer receives timer_tick from the shared student
// channel.
function emitToTeacherGameTick(pin: string, seconds: number): Promise<void> {
  return pusher
    .trigger(`private-teacher-${pin}`, 'timer_tick', seconds)
    .then(() => undefined)
    .catch((err) => {
      console.error(`Pusher trigger error (teacher tick -> ${pin}):`, err);
    });
}

// Helper: Broadcast the game state. Students (shared `game-<pin>` channel) get
// the student-safe sanitized copy; the teacher (private channel) gets the full
// authoritative state. Awaited at every call site so the state is persisted AND
// the event is actually sent before the response goes out.
async function broadcastGameState(pin: string, game: GameSession): Promise<void> {
  await emitToGame(pin, 'game_state', buildStudentSafeGameState(game));
  await emitToTeacherGame(pin, game);
}

// ============================================================
// Presence (QISM D / F / G)
//
// The server is authoritative for who is "present": every teacher and student
// browser reports in periodically via /api/teacher-heartbeat and
// /api/student-heartbeat, and the sweeper below expires anyone whose
// heartbeat has gone stale past their grace period. Heartbeat + grace is an
// accepted heuristic (WebSocket stacks have the same "no hard disconnect
// guarantee"), and the lazy sweep below runs only when someone actually
// touches the game, which is cheap and works on serverless.
// ============================================================

// Run the presence sweep on `game` (must be called inside withGameLock).
// Cleans up the store reverse-maps/session tokens of students who were
// removed and returns what changed.
async function sweepGamePresence(
  pin: string,
  game: GameSession
): Promise<ReturnType<typeof applyPresenceSweep>> {
  const result = applyPresenceSweep(game, Date.now());
  for (const { id } of result.removedStudents) {
    await store.deleteStudentPin(id);
    await store.deleteSessionToken(id);
  }
  return result;
}

function notifyPresenceSweep(
  pin: string,
  result: ReturnType<typeof applyPresenceSweep>
): void {
  if (result.teacherEnded) {
    emitToGame(pin, 'notification', {
      type: 'warning',
      text: "O'qituvchi aloqasi uzilgani sababli o'yin yakunlandi! O'qituvchi qaytgach, o'yinni davom ettirishi yoki yangilashi mumkin.",
    });
    return;
  }
  if (result.removedStudents.length > 0) {
    const names = result.removedStudents
      .slice(0, 3)
      .map((s) => s.name)
      .join(', ');
    const extra =
      result.removedStudents.length > 3
        ? ` va yana ${result.removedStudents.length - 3} ta o'quvchi`
        : '';
    emitToGame(pin, 'notification', {
      type: 'info',
      text: `O'quvchi(lar) ulanishi uzilgani sababli o'yindan chiqarildi: ${names}${extra}`,
    });
  }
}

// Kick every connected student out of the current game channel (used when the
// PIN changes / is regenerated and everyone must re-authenticate).
function notifyKickAllStudents(pin: string, reason: string): void {
  emitToGame(pin, 'kicked_out', reason);
  emitToGame(pin, 'error_message', reason);
}

// Defaults for a freshly created / reset game session.
function newGameDefaults(game: GameSession): GameSession {
  game.currentRound = 1;
  game.questionsPerRound = questionsPerRound();
  game.questionsPlayedInRound = 0;
  game.usedQuestionIds = [];
  game.teacherLastSeenAt = Date.now();
  game.reconnectWhitelist = [];
  return game;
}

// Index of the first question that has not yet been used, or -1 when every
// question in the bank has been played (QISM I — non-repeating questions).
function findFirstUnusedIndex(game: GameSession): number {
  const used = new Set(game.usedQuestionIds ?? []);
  for (let i = 0; i < game.questions.length; i++) {
    if (!used.has(game.questions[i].id)) return i;
  }
  return -1;
}

// Chat channel naming:
//   private: private-chat-<pin>-<studentId>   (student <-> teacher, 1:1)
//   group:   private-chat-<pin>-g-<teamId>    (all members of one group)
// Embedding the group in the channel name is what keeps group traffic isolated
// at the realtime layer: a student only ever subscribes to their own group's
// channel, so other groups' messages are never delivered to them.
function chatChannelName(pin: string, roomType: 'private' | 'group', id: string): string {
  return roomType === 'group' ? `private-chat-${pin}-g-${id}` : `private-chat-${pin}-${id}`;
}

// Helper: Trigger an event on a private/group chat channel.
function emitToChat(
  pin: string,
  roomType: 'private' | 'group',
  roomId: string,
  event: string,
  data: unknown
): Promise<void> {
  return pusher
    .trigger(chatChannelName(pin, roomType, roomId), event, data)
    .then(() => undefined)
    .catch((err) => {
      console.error(`Pusher trigger error (${event} -> chat ${pin}/${roomType}/${roomId}):`, err);
    });
}

// ============================================================
// Client session verification.
//
// Every chat-related request must carry BOTH a clientId and the session token
// the server minted for it (create-game / join-game). The token is sent as an
// `Authorization: Bearer ...` header (JSON API calls) or as a `sessionToken`
// field (pusher-js form posts). Without a matching token a stolen clientId is
// useless, closing the clientId-spoofing hole.
//
// The constants and helpers live in src/server/security.ts (SESSION_TOKEN_REGEX,
// CHAT_RATE_LIMIT_*, JOIN_ATTEMPT_*, PIN_LIFETIME_MS, isPinExpired, clientIp,
// verifyChatClient, requireTeacherAuth, respondAuthError).
// ============================================================

// Helper: Generate a unique 6-digit PIN (checks the shared store)
async function generateUniquePin(): Promise<string> {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while ((await store.getGame(pin)) !== null);
  return pin;
}

// ============================================================
// REST API + Pusher Channels
// ============================================================

// Helper: Get teacher's game (validates client is the game host)
async function getTeacherGame(clientId: string): Promise<{ pin: string; game: GameSession } | null> {
  const pin = await store.getTeacherPin(clientId);
  if (!pin) return null;
  const game = await store.getGame(pin);
  if (!game || game.teacherClientId !== clientId) return null;
  return { pin, game };
}

// Helper: Get student's game by their clientId
async function getStudentGame(clientId: string): Promise<{ pin: string; game: GameSession; student: Student } | null> {
  const pin = await store.getStudentPin(clientId);
  if (!pin) return null;
  const game = await store.getGame(pin);
  const student = game?.students[clientId];
  if (!game || !student) return null;
  return { pin, game, student };
}

// REST API: Health Check
app.get('/api/health', ah(async (req, res) => {
  res.json({ status: 'ok', activeGames: await store.listActiveGames() });
}));

// REST API: Fetch authoritative game state for a teacher or student client.
// Clients subscribe to a Pusher channel asynchronously, so a game_state event
// broadcast before the subscription was confirmed is silently dropped by
// Channels and never replayed. Clients pull the current state once their
// subscription is live (and again after every reconnect) to recover any missed
// event — this is what guarantees a teacher sees the very first student login.
app.get('/api/game-state', ah(async (req, res) => {
  const clientId = (req.query?.clientId || '').toString();
  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  // Presence sweep before serving: a pull is a natural point to notice an
  // expired teacher/student and return the up-to-date (possibly ended/trimmed)
  // state instead of a stale snapshot.
  const teacherPin = await store.getTeacherPin(clientId);
  if (teacherPin) {
    const r = await store.withGameLock(teacherPin, async (game) => {
      if (game.teacherClientId !== clientId) return { ok: false };
      const sweep = await sweepGamePresence(teacherPin, game);
      return { ok: true, game, data: sweep };
    });
    if (r && r.game && r.ok) {
      if (r.data && (r.data.teacherEnded || r.data.removedStudents.length > 0)) {
        await broadcastGameState(teacherPin, r.game);
        notifyPresenceSweep(teacherPin, r.data);
      }
      res.json({ success: true, game: r.game });
      return;
    }
  }

  const studentPin = await store.getStudentPin(clientId);
  if (studentPin) {
    const r = await store.withGameLock(studentPin, async (game) => {
      if (!game.students[clientId]) return { ok: false };
      const sweep = await sweepGamePresence(studentPin, game);
      return { ok: true, game, data: sweep };
    });
    if (r && r.game && r.ok) {
      if (r.data && (r.data.teacherEnded || r.data.removedStudents.length > 0)) {
        await broadcastGameState(studentPin, r.game);
        notifyPresenceSweep(studentPin, r.data);
      }
      // Students only ever receive the sanitized state (question/answer hidden
      // per phase); the teacher branch above returns the full state.
      res.json({ success: true, game: buildStudentSafeGameState(r.game) });
      return;
    }
  }

  res.json({ success: false, message: "Faol o'yin topilmadi!" });
}));

// 1. TEACHER: Create new game session (or reset)
app.post('/api/create-game', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  // Abuse guard: creating a game (and minting a session token) is unauthenticated
  // by design, so cap how many games one IP may create per window. Prevents
  // flooding the store with throwaway games.
  const rlc = await store.checkRateLimit(
    `create:${clientIp(req)}`,
    CREATE_GAME_LIMIT,
    CREATE_GAME_WINDOW_MS
  );
  if (!rlc.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(rlc.retryAfterMs / 1000))));
    res.status(429).json({
      success: false,
      message: 'Juda ko\'p o\'yin yaratildi, biroz kuting!',
      retryAfterMs: rlc.retryAfterMs,
    });
    return;
  }

  // Clean up old game if this client was host elsewhere
  const oldPin = await store.getTeacherPin(clientId);
  if (oldPin) {
    const oldGame = await store.getGame(oldPin);
    if (oldGame) {
      emitToGame(oldPin, 'kicked_out', 'Parolni xato kiritdingiz');
      emitToGame(oldPin, 'error_message', 'Parolni xato kiritdingiz');
      await store.deleteGame(oldPin);
    }
  }

  const pin = await generateUniquePin();
  const initialQuestions = await store.loadQuestions();
  const newGame: GameSession = {
    pin,
    teacherClientId: clientId,
    phase: 'LOBBY',
    students: {},
    teams: {},
    questions: initialQuestions,
    currentQuestionIndex: 0,
    timerSeconds: initialQuestions[0]?.timeLimit || 30,
    isTimerRunning: false,
    maxScoreLimit: 500,
    feedbacks: [],
    createdAt: Date.now(),
    pinExpiresAt: Date.now() + PIN_LIFETIME_MS,
  };
  newGameDefaults(newGame);

  await store.setGame(pin, newGame);
  await store.setTeacherPin(clientId, pin);

  // Mint the client's session token on first registration. From now on every
  // chat request for this clientId must also present this token.
  const sessionToken = await store.createSessionToken(clientId);

  console.log(`Yangi o'yin seansi yaratildi! PIN: ${pin}`);

  await broadcastGameState(pin, newGame);
  res.json({ success: true, pin, game: newGame, sessionToken });
}));

// 2. STUDENT: Join existing game via PIN & Name
app.post('/api/join-game', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const pin = (req.body?.pin || '').toString().trim();
  const name = (req.body?.name || '').toString().trim().slice(0, 64);

  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  if (!name) {
    res.json({ success: false, message: 'Ism kiritilmadi!' });
    return;
  }

  // Brute-force guard on the 6-digit PIN. A failed join (the PIN does not
  // resolve to a live game — or expired) counts against the calling IP; once
  // the per-IP budget of failed attempts in the window is spent, further
  // attempts are blocked for the rest of the window. A *successful* join is not
  // counted.
  const gameExists = await store.getGame(pin);
  if (!gameExists || isPinExpired(gameExists)) {
    const rl = await store.checkRateLimit(
      `join:${clientIp(req)}`,
      JOIN_ATTEMPT_LIMIT,
      JOIN_ATTEMPT_WINDOW_MS
    );
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))));
      res.status(429).json({
        success: false,
        message: 'Juda ko\'p noto\'g\'ri urinishlar, biroz kuting!',
        retryAfterMs: rl.retryAfterMs,
      });
      return;
    }
    res.json({
      success: false,
      message: `Bunday PIN-kodli faol o'yin topilmadi! Iltimos, o'qituvchidan PIN-kodni qayta surishtiring.`,
    });
    return;
  }

  const r = await store.withGameLock(pin, async (game) => {
    // Check name collision in game
    const existingStudent = Object.values(game.students).find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );

    if (existingStudent) {
      // Identity hijack guard: a "reconnect" is only legitimate from the SAME
      // browser (the same clientId), OR when the teacher has explicitly cleared
      // this name for re-claim (phone/browser switch). Otherwise a different
      // clientId claiming an existing student's name would silently steal their
      // identity (team membership, chat, scores).
      if (existingStudent.id !== clientId) {
        const whitelist = game.reconnectWhitelist ?? [];
        const reclaimable = whitelist.includes(name.toLowerCase());

        if (!reclaimable) {
          return {
            ok: false,
            message: `"${existingStudent.name}" ismi allaqachon band (boshqa qurilmada ulangan). Iltimos, o'z ismingizni tanlang yoki o'qituvchidan yordam so'rang.`,
          };
        }

        // Teacher-approved reclaim: the new device takes over the seat, keeping
        // the existing record (and thus the team membership / score / chat).
        // The old device's session token is revoked so it can no longer act.
        const oldId = existingStudent.id;
        if (oldId && oldId !== clientId) {
          await store.deleteSessionToken(oldId);
        }
        existingStudent.id = clientId;
        existingStudent.connected = true;
        existingStudent.lastSeenAt = Date.now();
        game.students[clientId] = existingStudent;
        delete game.students[oldId];
        // This reclaim opportunity was consumed by this join.
        game.reconnectWhitelist = whitelist.filter((w) => w !== name.toLowerCase());
        return { ok: true, game };
      }
      // True reconnect from the same browser: refresh presence timestamps.
      existingStudent.connected = true;
      existingStudent.lastSeenAt = Date.now();
      game.students[clientId] = existingStudent;
    } else {
      // New student register
      const newStudent: Student = {
        id: clientId,
        name,
        pin,
        teamId: null,
        isLeader: false,
        connected: true,
        lastSeenAt: Date.now(),
      };
      game.students[clientId] = newStudent;
    }

    return { ok: true, game };
  });

  if (!r) {
    res.json({
      success: false,
      message: `Bunday PIN-kodli faol o'yin topilmadi! Iltimos, o'qituvchidan PIN-kodni qayta surishtiring.`,
    });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message || 'Qo\'shilishda xatolik yuz berdi' });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }

  await store.setStudentPin(clientId, pin);

  // Mint the client's session token on first registration; reuse if it already
  // exists (reconnect on the same browser keeps the same clientId).
  const sessionToken = await store.createSessionToken(clientId);

  if (r.game.phase !== 'LOBBY' && r.game.phase !== 'TEAMS_SETUP') {
    emitToGame(pin, 'notification', {
      type: 'warning',
      text: `Yangi o'quvchi (${name}) ulandi! O'yin boshlanganligi sababli u kutish zalida.`,
    });
  } else {
    emitToGame(pin, 'notification', {
      type: 'info',
      text: `${name} o'yinga qo'shildi!`,
    });
  }

  await broadcastGameState(pin, r.game);
  res.json({ success: true, studentId: clientId, game: buildStudentSafeGameState(r.game), sessionToken });
}));

// 3. TEACHER: Create a Team
app.post('/api/create-team', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const teamCount = Object.keys(game.teams).length;
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const teamColor = req.body?.color || TEAM_COLORS[teamCount % TEAM_COLORS.length];

    const newTeam: Team = {
      id: teamId,
      name: (req.body?.name || `Guruh ${teamCount + 1}`).toString().slice(0, 64),
      color: teamColor,
      score: 100, // Initial score 100 points
      leaderClientId: null,
      memberIds: [],
      currentBet: null,
      currentAnswer: null,
      answerSubmittedAt: null,
      isEliminated: false,
      lastResult: null,
    };

    game.teams[teamId] = newTeam;
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 4. TEACHER: Delete a Team
app.post('/api/delete-team', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const team = game.teams[req.body?.teamId];
    if (team) {
      // Remove team assignment from students
      team.memberIds.forEach((studentId) => {
        if (game.students[studentId]) {
          game.students[studentId].teamId = null;
          game.students[studentId].isLeader = false;
        }
      });
      delete game.teams[team.id];
    }
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 5. TEACHER: Assign Student to Team
app.post('/api/assign-student', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const studentId = req.body?.studentId;
    const teamId = req.body?.teamId || null;
    const student = game.students[studentId];
    if (!student) {
      return { ok: false, game };
    }

    // Remove from previous team if any
    if (student.teamId && game.teams[student.teamId]) {
      const prevTeam = game.teams[student.teamId];
      prevTeam.memberIds = prevTeam.memberIds.filter((id) => id !== studentId);
      if (prevTeam.leaderClientId === studentId) {
        prevTeam.leaderClientId = prevTeam.memberIds[0] || null;
      }
    }

    student.teamId = teamId;
    student.isLeader = false;

    if (teamId && game.teams[teamId]) {
      const targetTeam = game.teams[teamId];
      if (!targetTeam.memberIds.includes(studentId)) {
        targetTeam.memberIds.push(studentId);
      }
      // If team has no leader, assign this student as leader automatically
      if (!targetTeam.leaderClientId) {
        targetTeam.leaderClientId = studentId;
        student.isLeader = true;
      }
    }

    return { ok: true, game };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 5b. TEACHER: Bulk Assign Students to Team
app.post('/api/bulk-assign-students', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const studentIds: string[] = req.body?.studentIds || [];
    const teamId = req.body?.teamId || null;

    studentIds.forEach((studentId) => {
      const student = game.students[studentId];
      if (!student) return;

      if (student.teamId && game.teams[student.teamId]) {
        const prevTeam = game.teams[student.teamId];
        prevTeam.memberIds = prevTeam.memberIds.filter((id) => id !== studentId);
        if (prevTeam.leaderClientId === studentId) {
          prevTeam.leaderClientId = prevTeam.memberIds[0] || null;
        }
      }

      student.teamId = teamId;
      student.isLeader = false;

      if (teamId && game.teams[teamId]) {
        const targetTeam = game.teams[teamId];
        if (!targetTeam.memberIds.includes(studentId)) {
          targetTeam.memberIds.push(studentId);
        }
        if (!targetTeam.leaderClientId) {
          targetTeam.leaderClientId = studentId;
          student.isLeader = true;
        }
      }
    });

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 5c. TEACHER: Kick / Remove student from game
app.post('/api/kick-student', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, async (game) => {
    const studentId = req.body?.studentId;
    const student = game.students[studentId];
    if (!student) {
      return { ok: false, game };
    }

    if (student.teamId && game.teams[student.teamId]) {
      const team = game.teams[student.teamId];
      team.memberIds = team.memberIds.filter((id) => id !== studentId);
      if (team.leaderClientId === studentId) {
        team.leaderClientId = team.memberIds[0] || null;
      }
    }

    delete game.students[studentId];
    await store.deleteStudentPin(studentId);
    await store.deleteSessionToken(studentId);
    return { ok: true, game };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 5d. TEACHER: Allow a student to reclaim their name from a new device/phone.
//
// When a student switches to a new browser (fresh clientId) they can no longer
// reuse their old name — the identity-hijack guard rejects it. This endpoint
// lets the teacher explicitly clear that name for re-claim (recorded on the
// game's reconnectWhitelist). The next join with that name takes over the seat,
// keeping the student's team membership / score / chat intact, and the old
// device's session token is revoked.
app.post('/api/reconnect-student', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }

  const studentId = (req.body?.studentId || '').toString();
  const r = await store.withGameLock(context.pin, (game) => {
    const student = game.students[studentId];
    if (!student) {
      return { ok: false, message: 'O\'quvchi topilmadi!', game };
    }
    game.reconnectWhitelist = Array.from(
      new Set([...(game.reconnectWhitelist ?? []), student.name.toLowerCase()])
    );
    return { ok: true, game, data: { studentName: student.name } };
  });

  if (!r) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message || 'Xatolik yuz berdi' });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'info',
    text: `"${r.data?.studentName}" qayta ulanish uchun ruxsat berildi (yangi qurilmadan kirsin).`,
  });
  res.json({ success: true, message: `"${r.data?.studentName}" qayta ulanishi mumkin` });
}));

// 6. TEACHER: Set explicit Team Leader
app.post('/api/set-team-leader', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const studentId = req.body?.studentId;
    const teamId = req.body?.teamId;
    const team = game.teams[teamId];
    if (!team) {
      return { ok: false, game };
    }

    // Unset current leader in team
    team.memberIds.forEach((id) => {
      if (game.students[id]) {
        game.students[id].isLeader = id === studentId;
      }
    });

    team.leaderClientId = studentId;
    return { ok: true, game };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 6b. TEACHER: Penalize Team (-5 points for noise/disruption)
app.post('/api/penalize-team', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const team = game.teams[req.body?.teamId];
    if (!team) {
      return { ok: false, message: 'Guruh topilmadi!', game };
    }

    // Points must be a positive integer (1, 2, 3, ...). A negative or zero
    // value would otherwise add points back to the team (Math.max floor).
    let penalty = 5;
    const rawPoints = req.body?.points;
    if (rawPoints !== undefined && rawPoints !== null && rawPoints !== '') {
      const p = Number(rawPoints);
      if (!Number.isInteger(p) || p < 1) {
        return {
          ok: false,
          message: 'Jarima balli 1 yoki undan katta butun son bo\'lishi shart!',
          game,
        };
      }
      penalty = p;
    }

    team.score = Math.max(0, team.score - penalty);
    if (team.score <= 0) {
      team.isEliminated = true;
    }

    return {
      ok: true,
      game,
      data: {
        teamName: team.name,
        teamScore: team.score,
        penalty,
        reason: req.body?.reason || 'shovqin qilgani uchun',
      },
    };
  });

  if (!r) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message || 'Jarima qo\'shishda xatolik yuz berdi' });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'warning',
    text: `${r.data?.teamName} jamoasidan ${r.data?.reason} -${r.data?.penalty} ball olindi! Joriy ball: ${r.data?.teamScore}`,
  });
  res.json({ success: true });
}));

// 7. TEACHER: Set Question Database
app.post('/api/set-questions', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, async (game) => {
    const questions: Question[] = req.body?.questions || [];
    game.questions = questions;
    game.currentQuestionIndex = 0;
    game.timerSeconds = questions[0]?.timeLimit || 30;
    await store.saveQuestions(questions);
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 8. TEACHER: Start Betting Phase for a Question
app.post('/api/start-betting-phase', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const used = new Set(game.usedQuestionIds ?? []);

    // The teacher either picks a specific unused question (from the modal) or
    // falls back to the currentQuestionIndex. A question may never re-appear
    // (QISM I): if the supplied index is already used we reject the request.
    // When no explicit index is given, auto-select the first unused question.
    let qIndex: number;
    const requestIndex = req.body?.questionIndex;
    if (typeof requestIndex === 'number' && requestIndex >= 0 && requestIndex < game.questions.length) {
      const picked = game.questions[requestIndex];
      if (used.has(picked.id)) {
        return { ok: false, message: 'Bu savol allaqachon ishlatilgan, boshqa savol tanlang!', game };
      }
      qIndex = requestIndex;
    } else {
      qIndex = findFirstUnusedIndex(game);
      if (qIndex === -1) {
        game.phase = 'GAME_OVER';
        game.isTimerRunning = false;
        return { ok: false, message: 'Barcha savollar ishlatildi! O\'yin yakunlandi.', game };
      }
    }

    game.currentQuestionIndex = qIndex;
    const currentQ = game.questions[qIndex];
    game.timerSeconds = currentQ?.timeLimit || 30;
    game.phase = 'BETTING';
    game.isTimerRunning = false;
    // Count questions started inside the current round (QISM H). The round
    // counter is cosmetic (the game is unlimited); it just rolls forever.
    game.questionsPlayedInRound = (game.questionsPlayedInRound ?? 0) + 1;
    game.usedQuestionIds = [...used, currentQ.id];

    // Reset current bets and answers for all non-eliminated teams
    Object.values(game.teams).forEach((team) => {
      team.currentBet = null;
      team.currentAnswer = null;
      team.answerSubmittedAt = null;
      team.lastResult = null;
    });

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  if (!r.ok) {
    if (r.game.phase === 'GAME_OVER') {
      await broadcastGameState(context.pin, r.game);
    }
    res.json({ success: false, message: r.message });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'info',
    text: 'Savol ekranga chiqdi! Jamoalar ball tikishni boshlang.',
  });
  res.json({ success: true });
}));

// 9. TEAM LEADER: Place Bet
app.post('/api/place-bet', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = await getStudentGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    if (game.phase !== 'BETTING') {
      return { ok: false, message: 'Hozir ball tikish vaqti emas!' };
    }

    const student = game.students[clientId];
    if (!student || !student.teamId || !student.isLeader) {
      return { ok: false, message: `Faqat Guruh Boshlig'i (Sardor) ball tika oladi!` };
    }

    const team = game.teams[student.teamId];
    if (!team || team.isEliminated) {
      return { ok: false, message: `Sizning jamoangiz o'yindan chiqqan!` };
    }

    const numericBet = Math.floor(Number(req.body?.bet));
    if (isNaN(numericBet) || numericBet < 1 || numericBet > team.score) {
      return {
        ok: false,
        message: `Tikiladigan ball 1 va jamoaning mavjud bali (${team.score}) oralig'ida bo'lishi shart!`,
      };
    }

    team.currentBet = numericBet;
    return { ok: true, game, data: { teamId: team.id, teamName: team.name, bet: numericBet } };
  });

  if (!r) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);

  emitToGame(context.pin, 'bet_placed', { teamId: r.data?.teamId, bet: r.data?.bet });
  emitToGame(context.pin, 'notification', {
    type: 'success',
    text: `${r.data?.teamName} jamoasi ${r.data?.bet} ball tikdi!`,
  });
  res.json({ success: true });
}));

// 10. TEACHER: Start Answering Phase
// The countdown is driven by the teacher's browser (TeacherView) which calls
// /api/timer-tick once per second. This works on serverless (Vercel) where a
// server-side setInterval would be killed when the lambda returns.
app.post('/api/start-answering-phase', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    // The teacher is authoritative: they may reveal the question and start the
    // answering timer even if some teams have not bet yet. Un-bet teams simply
    // score 0 for this question (their currentBet stays null and finish-round
    // ignores them for auto-grading). The BETTING banner already surfaces who
    // has/hasn't bet, so the teacher can decide.
    const currentQ = game.questions[game.currentQuestionIndex];
    game.timerSeconds = currentQ?.timeLimit || 30;
    game.phase = 'ANSWERING';
    game.isTimerRunning = true;
    return { ok: true, game };
  });

  if (!r) {
    res.json({ success: false });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }

  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'info',
    text: `O'qituvchi taymerni boshladi! Guruh sardorlari javob kiritishi mumkin!`,
  });
  res.json({ success: true });
}));

// 10b. TEACHER (client-driven): Report the current countdown second.
// The teacher's browser sends the remaining seconds once per second; the server
// persists it, broadcasts timer_tick to all students, and automatically moves
// to GRADING when the countdown reaches 0.
app.post('/api/timer-tick', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const pin = await store.getTeacherPin(clientId);
  if (!pin) {
    res.json({ success: false });
    return;
  }

  const seconds = Math.max(0, Math.floor(Number(req.body?.seconds)));
  if (isNaN(seconds)) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(pin, (game) => {
    if (game.teacherClientId !== clientId || game.phase !== 'ANSWERING') {
      // Stale/ignored tick (e.g. arrived after the teacher stopped the timer).
      return { ok: false };
    }
    game.timerSeconds = seconds;
    if (seconds <= 0) {
      game.phase = 'GRADING';
      game.isTimerRunning = false;
    }
    return { ok: true, game };
  });

  if (!r || !r.ok || !r.game) {
    res.json({ success: true });
    return;
  }

  if (r.game.phase === 'GRADING') {
    await broadcastGameState(pin, r.game);
    emitToGame(pin, 'notification', {
      type: 'warning',
      text: `Vaqt tugadi! Javoblar qabul qilish to'xtatildi.`,
    });
  } else {
    emitToGame(pin, 'timer_tick', r.game.timerSeconds);
    emitToTeacherGameTick(pin, r.game.timerSeconds);
  }
  res.json({ success: true });
}));

// 11. TEACHER: Manually Stop Answering Phase
app.post('/api/stop-answering-phase', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    game.phase = 'GRADING';
    game.isTimerRunning = false;
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 12. TEAM LEADER: Submit Answer
app.post('/api/submit-answer', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = await getStudentGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    if (game.phase !== 'ANSWERING') {
      return { ok: false, message: 'Hozir javob yuborish vaqti emas yoki javoblar yopiq!' };
    }

    const student = game.students[clientId];
    if (!student || !student.teamId || !student.isLeader) {
      return { ok: false, message: `Faqat Guruh Boshlig'i (Sardor) javob yubora oladi!` };
    }

    const team = game.teams[student.teamId];
    if (!team || team.isEliminated) {
      return { ok: false, message: `Sizning jamoangiz o'yindan chiqqan!` };
    }

    if (team.currentBet === null) {
      return { ok: false, message: 'Javob berishdan oldin ball tikish shart edi!' };
    }

    team.currentAnswer = (req.body?.answer || '').trim();
    team.answerSubmittedAt = Date.now();

    return { ok: true, game, data: { teamId: team.id, teamName: team.name } };
  });

  if (!r) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'answer_submitted', { teamId: r.data?.teamId, teamName: r.data?.teamName });
  emitToGame(context.pin, 'notification', {
    type: 'success',
    text: `${r.data?.teamName} javob yubordi!`,
  });
  res.json({ success: true });
}));

// 13. TEACHER: Grade/Evaluate Team Answer
app.post('/api/grade-team-answer', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    if (game.phase !== 'GRADING') {
      return { ok: false, message: 'Hozir baholash bosqichi emas!', game };
    }

    const team = game.teams[req.body?.teamId];
    if (!team || team.currentBet === null) {
      return { ok: false, message: 'Bu guruh tikish kiritmagan yoki topilmadi!', game };
    }

    // Double-grading protection: each team is graded exactly once per round.
    // A repeated grade would silently add/subtract the bet a second time.
    if (team.lastResult !== null) {
      return { ok: false, message: `${team.name} jamoasi allaqachon baholangan!`, game };
    }

    const isCorrect = req.body?.isCorrect === true;
    const bet = team.currentBet;
    const pointsDelta = isCorrect ? bet : -bet;
    const currentQ = game.questions[game.currentQuestionIndex];

    team.score += pointsDelta;
    team.lastResult = {
      isCorrect,
      pointsDelta,
      bet,
      answer: team.currentAnswer || '(Javob berilmadi)',
      correctAnswer: currentQ?.correctAnswer || '',
    };

    // Check elimination rule (Score <= 0)
    if (team.score <= 0) {
      team.score = 0;
      team.isEliminated = true;
      emitToGame(context.pin, 'notification', {
        type: 'warning',
        text: `${team.name} jamoasining bali 0 ga tushib qoldi va avtomatik ravishda o'yindan chiqdi!`,
      });
    }

    return { ok: true, game };
  });

  if (!r) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message || 'Baholashda xatolik yuz berdi' });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 14. TEACHER: Finish Round & Show Round Standings
app.post('/api/finish-round', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    // Guard against double-finish: only valid from the GRADING phase, so a
    // repeated request cannot auto-grade and advance the round twice.
    if (game.phase !== 'GRADING') {
      return { ok: false, message: 'Hozir baholash bosqichi emas!', game };
    }

    // Auto-grade remaining un-graded teams against current question's correct answer if options match
    const currentQ = game.questions[game.currentQuestionIndex];
    if (currentQ) {
      Object.values(game.teams).forEach((team) => {
        if (!team.isEliminated && team.currentBet !== null && team.lastResult === null) {
          const isMatch =
            team.currentAnswer &&
            team.currentAnswer.trim().toLowerCase() ===
              currentQ.correctAnswer.trim().toLowerCase();
          const bet = team.currentBet;
          const pointsDelta = isMatch ? bet : -bet;

          team.score += pointsDelta;
          team.lastResult = {
            isCorrect: !!isMatch,
            pointsDelta,
            bet,
            answer: team.currentAnswer || '(Javob berilmadi)',
            correctAnswer: currentQ.correctAnswer,
          };

          if (team.score <= 0) {
            team.score = 0;
            team.isEliminated = true;
          }
        }
      });
    }

    // Check if game is over: only when at most one non-eliminated team remains.
    // With unlimited rounds (QISM I) running out of sequential question indexes
    // no longer ends the game — the bank-exhaust case is handled instead by
    // /api/next-question and /api/start-betting-phase, which declare GAME_OVER
    // once every question has been used.
    const activeTeams = Object.values(game.teams).filter((t) => !t.isEliminated);
    if (activeTeams.length <= 1) {
      game.phase = 'GAME_OVER';
    } else {
      // Advance the round once the current round's question budget is spent
      // (QISM H). Scores stay cumulative; only the round counter moves. This is
      // purely cosmetic now — rounds continue forever.
      const played = game.questionsPlayedInRound ?? 0;
      const perRound = game.questionsPerRound ?? questionsPerRound();
      if (played >= perRound) {
        game.currentRound = (game.currentRound ?? 1) + 1;
        game.questionsPlayedInRound = 0;
      }
      game.phase = 'ROUND_RESULT';
    }
    game.isTimerRunning = false;

    return { ok: true, game };
  });

  if (!r) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message || 'Raund yakunlashda xatolik yuz berdi' });
    return;
  }
  if (!r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 15. TEACHER: Next Question
app.post('/api/next-question', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const used = new Set(game.usedQuestionIds ?? []);
    // Advance to the next UNUSED question (QISM I — non-repeat). The game has
    // unlimited rounds; it only ends when the whole bank has been used.
    const nextIdx = findFirstUnusedIndex(game);
    if (nextIdx === -1) {
      game.phase = 'GAME_OVER';
      game.isTimerRunning = false;
    } else {
      const q = game.questions[nextIdx];
      game.currentQuestionIndex = nextIdx;
      game.timerSeconds = q?.timeLimit || 30;
      game.phase = 'BETTING';
      game.isTimerRunning = false;
      game.usedQuestionIds = [...used, q.id];
      game.questionsPlayedInRound = (game.questionsPlayedInRound ?? 0) + 1;

      Object.values(game.teams).forEach((team) => {
        team.currentBet = null;
        team.currentAnswer = null;
        team.answerSubmittedAt = null;
        team.lastResult = null;
      });
    }

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 16. TEACHER: Change Game Phase directly
app.post('/api/set-game-phase', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const phase = (req.body?.phase as string) || '';
    if (['LOBBY', 'TEAMS_SETUP', 'BETTING', 'ANSWERING', 'GRADING', 'ROUND_RESULT', 'GAME_OVER'].includes(phase)) {
      game.phase = phase as GameSession['phase'];
      if (phase !== 'ANSWERING') {
        game.isTimerRunning = false;
      }
    }
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  res.json({ success: true });
}));

// 17. TEACHER: Reset/Start New Game (Regenerate PIN)
app.post('/api/reset-game', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const oldPin = await store.getTeacherPin(clientId);

  if (oldPin) {
    const oldGame = await store.getGame(oldPin);
    if (oldGame) {
      emitToGame(oldPin, 'kicked_out', 'Parolni xato kiritdingiz');
      emitToGame(oldPin, 'error_message', 'Parolni xato kiritdingiz');
      await store.deleteGame(oldPin);
    }
  }

  // Generate NEW PIN Code
  const newPin = await generateUniquePin();
  const resetQuestions = await store.loadQuestions();

  const newGame: GameSession = {
    pin: newPin,
    teacherClientId: clientId,
    phase: 'LOBBY',
    students: {},
    teams: {},
    questions: resetQuestions,
    currentQuestionIndex: 0,
    timerSeconds: resetQuestions[0]?.timeLimit || 30,
    isTimerRunning: false,
    maxScoreLimit: 500,
    feedbacks: [],
    createdAt: Date.now(),
    pinExpiresAt: Date.now() + PIN_LIFETIME_MS,
  };
  newGameDefaults(newGame);

  await store.setGame(newPin, newGame);
  await store.setTeacherPin(clientId, newPin);

  console.log(`Yangi o'yin boshlandi! Yangi PIN: ${newPin}`);
  await broadcastGameState(newPin, newGame);
  res.json({ success: true, pin: newPin, game: newGame });
}));

// 17b. TEACHER: Stop Game but KEEP Teams & Students
app.post('/api/reset-game-keep-teams', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    game.phase = 'TEAMS_SETUP';
    game.currentQuestionIndex = 0;
    game.timerSeconds = game.questions[0]?.timeLimit || 30;
    game.isTimerRunning = false;
    game.currentRound = 1;
    game.questionsPlayedInRound = 0;
    game.questionsPerRound = questionsPerRound();
    game.usedQuestionIds = [];
    game.winners = [];
    game.winnersAnnouncedAt = undefined;
    game.teacherLastSeenAt = Date.now();

    Object.values(game.teams).forEach((team) => {
      team.currentBet = null;
      team.currentAnswer = null;
      team.answerSubmittedAt = null;
      team.lastResult = null;
      team.isEliminated = false;
    });

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'info',
    text: `O'yin to'xtatildi! Barcha guruhlar va o'quvchilar saqlanib qolindi.`,
  });
  res.json({ success: true });
}));

// 18. TEACHER: Update PIN code / password manually
app.post('/api/update-pin', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const cleanPin = (req.body?.newPin || '').toString().trim().toUpperCase();
  // PIN codes are store keys and channel suffixes: enforce a strict
  // alphanumeric format so a malformed value can never act as an
  // unexpected key/suffix (6 chars: 1 ~ million combinations).
  if (!/^[A-Z0-9]{6}$/.test(cleanPin)) {
    res.json({ success: false, message: `O'yin PIN-kodi (paroli) rosa 6 ta raqam yoki harfdan iborat bo'lishi shart!` });
    return;
  }

  const currentPin = await store.getTeacherPin(clientId);
  const game = currentPin ? await store.getGame(currentPin) : null;
  if (!game || game.teacherClientId !== clientId) {
    res.json({ success: false, message: `Faqat o'qituvchi PIN-kodni o'zgartira oladi!` });
    return;
  }

  if (cleanPin !== currentPin && (await store.getGame(cleanPin)) !== null) {
    res.json({ success: false, message: 'Ushbu PIN-kod (parol) boshqa faol o\'yinda ishlatilmoqda!' });
    return;
  }

  if (cleanPin === currentPin) {
    res.json({ success: true, pin: cleanPin, game });
    return;
  }

  // Notify connected students that PIN changed and kick them out
  notifyKickAllStudents(currentPin as string, 'Parolni xato kiritdingiz');

  // Transfer game to new PIN key and clear student list so they re-authenticate
  await store.deleteGame(currentPin as string);
  game.pin = cleanPin;
  game.pinExpiresAt = Date.now() + PIN_LIFETIME_MS;
  game.students = {};
  // Students are gone, so drop their team memberships too (the teacher re-assigns
  // everyone on the new PIN). Scores and team records are preserved.
  Object.values(game.teams).forEach((team) => {
    team.memberIds = [];
    team.leaderClientId = null;
  });
  newGameDefaults(game);
  await store.setGame(cleanPin, game);

  // Clear student pin mappings for the old game
  await store.clearStudentPinsForGame(currentPin as string);

  // Re-map teacher client
  await store.setTeacherPin(clientId, cleanPin);

  console.log(`PIN-kod (parol) o'zgartirildi va o'quvchilar chiqarildi: ${currentPin} -> ${cleanPin}`);
  await broadcastGameState(cleanPin, game);
  res.json({ success: true, pin: cleanPin, game });
}));

// 18b. TEACHER: Regenerate a brand-new random PIN and kick every student out
// (QISM E).
//
// Unlike /api/reset-game (which wipes everything) this PRESERVES teams and
// their scores; only student memberships are cleared so everyone must re-join
// with the fresh PIN. The teacher is re-mapped to the new PIN so their panel
// keeps working without a reload.
app.post('/api/regenerate-pin', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }

  const newPin = await generateUniquePin();

  const r = await store.withGameLock(context.pin, (game) => {
    notifyKickAllStudents(
      context.pin,
      "O'qituvchi PIN-kodni yangiladi! Iltimos, doskadagi yangi PIN-kod bilan qayta ulaning."
    );

    // Preserve teams + scores; drop student bindings so a fresh join wave
    // starts clean (no stale leader / member pointers to dead students).
    game.students = {};
    Object.values(game.teams).forEach((team) => {
      team.memberIds = [];
      team.leaderClientId = null;
    });
    game.pin = newPin;
    game.pinExpiresAt = Date.now() + PIN_LIFETIME_MS;
    newGameDefaults(game);
    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }

  await store.clearStudentPinsForGame(context.pin);
  await store.deleteGame(context.pin);
  await store.setGame(newPin, r.game);
  await store.setTeacherPin(clientId, newPin);

  console.log(`PIN-kod yangilandi (o'quvchilar chiqarildi, guruhlar saqlandi): ${context.pin} -> ${newPin}`);
  await broadcastGameState(newPin, r.game);
  res.json({ success: true, pin: newPin, game: r.game });
}));

// 18c. TEACHER: Presence heartbeat (QISM D/F).
// The teacher's browser reports in every few seconds. If this stops for longer
// than the teacher grace period, the game auto-ends (see applyPresenceSweep).
// The heartbeat itself also lazily sweeps stale students.
app.post('/api/teacher-heartbeat', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const pin = await store.getTeacherPin(clientId);
  if (!pin) {
    res.json({ success: false, message: "Siz o'yinga ulanmagansiz!" });
    return;
  }

  const r = await store.withGameLock(pin, async (game) => {
    if (game.teacherClientId !== clientId) return { ok: false };
    game.teacherLastSeenAt = Date.now();
    const sweep = await sweepGamePresence(pin, game);
    return { ok: true, game, data: sweep };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false, message: "Siz o'yinga ulanmagansiz!" });
    return;
  }
  if (r.data && (r.data.teacherEnded || r.data.removedStudents.length > 0)) {
    await broadcastGameState(pin, r.game);
    notifyPresenceSweep(pin, r.data);
  }
  res.json({ success: true });
}));

// 18d. STUDENT: Presence heartbeat (QISM G).
// Same idea as the teacher heartbeat. The caller's own lastSeen is refreshed
// BEFORE the sweep runs, so they are never removed by their own heartbeat; the
// sweep can only remove OTHER stale students or end the game when the TEACHER
// has gone silent.
app.post('/api/student-heartbeat', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const pin = await store.getStudentPin(clientId);
  if (!pin) {
    res.json({ success: false, message: "Siz o'yinga ulanmagansiz!" });
    return;
  }

  const r = await store.withGameLock(pin, async (game) => {
    const student = game.students[clientId];
    if (!student) {
      // Already removed (presence expiry or teacher kick). Tell the client so
      // it can return to the login screen.
      return { ok: false, message: 'Siz o\'yindan chiqarilgansiz! Qayta ulanish uchun kirishni takrorlang.' };
    }
    student.lastSeenAt = Date.now();
    student.connected = true;
    const sweep = await sweepGamePresence(pin, game);
    return { ok: true, game, data: sweep };
  });

  if (!r || !r.game) {
    res.json({ success: false, message: "Siz o'yinga ulanmagansiz!" });
    return;
  }
  if (!r.ok) {
    res.json({ success: false, message: r.message });
    return;
  }
  if (r.data && (r.data.teacherEnded || r.data.removedStudents.length > 0)) {
    await broadcastGameState(pin, r.game);
    notifyPresenceSweep(pin, r.data);
  }
  res.json({ success: true });
}));

// 18e. TEACHER: pagehide beacon — the teacher closed the tab/app. Ends the
// game immediately instead of waiting for the heartbeat grace period. The game
// is kept in GAME_OVER state so the teacher can come back and reset/replay it.
app.post('/api/teacher-leave', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: true });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    game.phase = 'GAME_OVER';
    game.isTimerRunning = false;
    return { ok: true, game };
  });

  if (r && r.game) {
    await broadcastGameState(context.pin, r.game);
    emitToGame(context.pin, 'notification', {
      type: 'warning',
      text: "O'qituvchi o'yin sahifasini yopdi! O'yin yakunlandi.",
    });
  }
  res.json({ success: true });
}));

// 18f. TEACHER: End the game early and announce the winners. Sets the phase to
// GAME_OVER, computes and persists the champion team(s) (top-scoring
// non-eliminated team; ties are all champions), and broadcasts so both the
// teacher and every student see the winner banner.
app.post('/api/end-game-and-announce-winners', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const authError = await requireTeacherAuth(req, clientId);
  if (respondAuthError(res, authError)) return;
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false, message: "Siz o'yinga ulanmagansiz!" });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    game.phase = 'GAME_OVER';
    game.isTimerRunning = false;

    const active = Object.values(game.teams).filter((t) => !t.isEliminated);
    const ranked = [...active].sort((a, b) => b.score - a.score);
    if (ranked.length > 0 && ranked[0].score > 0) {
      const top = ranked[0].score;
      game.winners = ranked.filter((t) => t.score === top).map((t) => t.id);
    } else {
      game.winners = [];
    }
    game.winnersAnnouncedAt = Date.now();

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'success',
    text: 'O\'yin yakunlandi! G\'olib(lar) e\'lon qilindi. 🏆',
  });
  res.json({ success: true });
}));

// 19. STUDENT: Submit Feedback/Review
app.post('/api/submit-feedback', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = await getStudentGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const student = game.students[clientId];
    if (!student) {
      return { ok: false };
    }
    const team = student.teamId ? game.teams[student.teamId] : null;

    if (!game.feedbacks) {
      game.feedbacks = [];
    }

    const newFeedback = {
      id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      studentId: clientId,
      studentName: student.name,
      teamName: team ? team.name : 'Guruhsiz',
      rating: ['Yaxshi', 'Yomon', "A'lo"].includes(req.body?.rating) ? req.body?.rating : "A'lo",
      comment: (req.body?.comment || '').toString().trim().slice(0, 1000),
      createdAt: Date.now(),
    };

    const existingIdx = game.feedbacks.findIndex((f) => f.studentId === clientId);
    if (existingIdx >= 0) {
      game.feedbacks[existingIdx] = newFeedback;
    } else {
      game.feedbacks.push(newFeedback);
    }

    return { ok: true, game, data: { studentName: student.name } };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  await broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'success',
    text: `${r.data?.studentName} o'yin haqida fikr bildirdi!`,
  });
  res.json({ success: true });
}));

// ============================================================
// Chat (private student <-> teacher)
// ============================================================

// Pusher private-channel authentication. Only the teacher of the game or the
// student who owns the chat may subscribe to `private-chat-{pin}-{studentId}`.
app.post('/api/pusher/auth', ah(async (req, res) => {
  const socketId = (req.body?.socket_id || '').toString();
  const channelName = (req.body?.channel_name || '').toString();
  const clientId = (req.body?.clientId || '').toString();

  if (!socketId || !channelName) {
    res.status(400).json({ error: 'socket_id va channel_name talab qilinadi!' });
    return;
  }

  // pusher-js sends "<digits>.<digits>"; anything else would make the Pusher
  // client throw and bubble up as a 500, so reject it cleanly instead.
  if (!socketId.match(/^\d+\.\d+$/)) {
    res.status(400).json({ error: 'socket_id noto\'g\'ri formatda!' });
    return;
  }

  // The caller must prove they own the clientId by presenting its session token.
  const authError = await verifyChatClient(req, clientId);
  if (authError) {
    res.status(authError.status).json(authError.body);
    return;
  }

  const match = channelName.match(/^private-chat-([A-Za-z0-9]+)-(.+)$/);
  const teacherMatch = channelName.match(/^private-teacher-([A-Za-z0-9]+)$/);

  // Teacher-private channel: only the teacher who owns this game may subscribe.
  // It carries the full (unsanitized) state, so authorization must be strict —
  // a student must never be able to join it.
  if (teacherMatch) {
    const pin = teacherMatch[1];
    const teacherPin = await store.getTeacherPin(clientId);
    const isTeacher = teacherPin === pin;
    if (!isTeacher) {
      res.status(403).json({ error: 'Ushbu kanalga kirish ruxsati yo\'q!' });
      return;
    }
    res.send(pusher.authorizeChannel(socketId, channelName));
    return;
  }

  if (!match) {
    res.status(400).json({ error: 'Noto\'g\'ri kanal nomi!' });
    return;
  }

  const pin = match[1];
  const rest = match[2];
  // "private-chat-<pin>-g-<teamId>" = group room, otherwise it is the 1:1
  // student <-> teacher room for that student id.
  const isGroupRoom = rest.startsWith('g-');
  const teamId = isGroupRoom ? rest.slice(2) : null;
  const studentId = isGroupRoom ? null : rest;

  const game = await store.getGame(pin);
  if (!game) {
    res.status(400).json({ error: 'O\'yin topilmadi!' });
    return;
  }

  const teacherPin = await store.getTeacherPin(clientId);
  const isTeacher = teacherPin === pin && game.teacherClientId === clientId;
  const student = game.students[clientId];

  let allowed = false;
  if (isTeacher) {
    // Teacher may subscribe to any room of their own game.
    allowed = true;
  } else if (isGroupRoom) {
    // A student may only join the room of their OWN group.
    allowed = !!teamId && !!student && student.teamId === teamId && !!game.teams[teamId];
  } else {
    // A student may only join their own 1:1 room with the teacher.
    allowed = clientId === studentId && !!student;
  }

  if (!allowed) {
    res.status(403).json({ error: 'Ushbu chatga kirish ruxsati yo\'q!' });
    return;
  }

  res.send(pusher.authorizeChannel(socketId, channelName));
}));

// Send a chat message. Students may only write to their own chat with the
// teacher; the teacher may write to any student's chat.
app.post('/api/chat/send', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();

  // 1) Identity: clientId must be bound to a valid session token.
  const authError = await verifyChatClient(req, clientId);
  if (authError) {
    res.status(authError.status).json(authError.body);
    return;
  }

  // 2) Payload validation: text is required and hard-truncated to 1000 chars
  //    both here and in the UI (input maxLength=1000).
  const text = (req.body?.text || '').toString().trim().slice(0, 1000);
  if (!text) {
    res.json({ success: false, message: 'Xabar bo\'sh bo\'lishi mumkin emas!' });
    return;
  }

  // 3) Rate limit: no more than CHAT_RATE_LIMIT_MAX messages per window per
  //    client, so a single client cannot flood the chat.
  const rl = await store.checkRateLimit(
    `chat:send:${clientId}`,
    CHAT_RATE_LIMIT_MAX,
    CHAT_RATE_LIMIT_WINDOW_MS
  );
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))));
    res.status(429).json({
      success: false,
      message: 'Juda tez xabar yubormoqdasiz, biroz kuting!',
      retryAfterMs: rl.retryAfterMs,
    });
    return;
  }

  const teacherPin = await store.getTeacherPin(clientId);
  const studentPin = await store.getStudentPin(clientId);

  // The requested room. roomType defaults to "private"; a group message is
  // requested by passing teamId (or roomType: "group").
  const requestedRoomType: 'private' | 'group' = req.body?.roomType === 'group' ? 'group' : 'private';

  let pin: string | null = null;
  let role: 'teacher' | 'student' = 'student';
  let senderName = '';
  let roomType: 'private' | 'group' = 'private';
  let roomId = '';

  if (teacherPin) {
    const game = await store.getGame(teacherPin);
    if (game && game.teacherClientId === clientId) {
      pin = teacherPin;
      role = 'teacher';
      senderName = "O'qituvchi";
      roomType = requestedRoomType;

      if (roomType === 'group') {
        // Teacher may write to any group room of their game.
        const teamId = (req.body?.teamId || '').toString();
        if (!teamId || !game.teams[teamId]) {
          res.json({ success: false, message: 'Bunday guruh bu o\'yinda topilmadi!' });
          return;
        }
        roomId = teamId;
      } else {
        const targetStudentId = (req.body?.studentId || '').toString();
        if (!targetStudentId || !game.students[targetStudentId]) {
          res.json({ success: false, message: 'Bunday o\'quvchi bu o\'yinda topilmadi!' });
          return;
        }
        roomId = targetStudentId;
      }
    }
  } else if (studentPin) {
    const game = await store.getGame(studentPin);
    const student = game?.students[clientId];
    if (game && student) {
      pin = studentPin;
      role = 'student';
      senderName = student.name;

      if (requestedRoomType === 'group') {
        const teamId = (req.body?.teamId || '').toString();
        roomType = 'group';
        // GROUP ISOLATION: a student may only post inside their own group's
        // room. Claiming another group's teamId is an attack -> 403.
        const ownTeamId = student.teamId;
        if (!teamId || !game.teams[teamId] || ownTeamId !== teamId) {
          res
            .status(403)
            .json({
              success: false,
              message: 'Boshqa guruh chatiga yozish ruxsati yo\'q! (faqat o\'z guruhingizga yozishingiz mumkin)',
            });
          return;
        }
        roomId = teamId;
      } else {
        roomType = 'private';
        // A student can only ever write inside their own private chat.
        roomId = clientId;
        // Explicitly claiming another student's chat is an attack: reject it
        // instead of silently redirecting so the violation is visible.
        const claimedTarget = (req.body?.studentId || '').toString();
        if (claimedTarget && claimedTarget !== clientId) {
          res
            .status(403)
            .json({ success: false, message: 'Boshqa o\'quvchi chatiga yozish ruxsati yo\'q!' });
          return;
        }
      }
    }
  }

  if (!pin || !roomId) {
    res.json({ success: false, message: 'Avval o\'yinga ulanish kerak!' });
    return;
  }

  const message = {
    id: 'cm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    senderId: clientId,
    senderName,
    role,
    text,
    createdAt: Date.now(),
    roomType,
    groupId: roomType === 'group' ? roomId : null,
  };

  await store.addChatMessage(pin, roomType === 'group' ? `g:${roomId}` : roomId, message);
  await emitToChat(pin, roomType, roomId, 'chat_message', message);

  res.json({ success: true, message });
}));

// Fetch message history for a chat room (private student<->teacher or a
// per-group room). Only the teacher of the game or the owning student may
// read a room, and students are isolated to their own group's room.
app.get('/api/chat/messages', ah(async (req, res) => {
  const clientId = (req.query?.clientId || '').toString();

  // Identity: clientId must be bound to a valid session token.
  const authError = await verifyChatClient(req, clientId);
  if (authError) {
    res.status(authError.status).json(authError.body);
    return;
  }

  const pin = (req.query?.pin || '').toString();
  const requestedRoomType: 'private' | 'group' = req.query?.roomType === 'group' ? 'group' : 'private';
  const teamId = (req.query?.teamId || '').toString();
  const studentId = (req.query?.studentId || '').toString();

  const game = await store.getGame(pin);
  if (!game) {
    res.json({ success: false, message: 'O\'yin topilmadi!' });
    return;
  }

  const teacherPin = await store.getTeacherPin(clientId);
  const isTeacher = teacherPin === pin && game.teacherClientId === clientId;
  const student = game.students[clientId];

  if (requestedRoomType === 'group') {
    // GROUP ISOLATION: a student may only read their OWN group's room.
    if (!isTeacher) {
      if (!student || student.teamId !== teamId || !game.teams[teamId]) {
        res
          .status(403)
          .json({ success: false, message: 'Boshqa guruh chatiga kirish ruxsati yo\'q!' });
        return;
      }
    } else if (!teamId || !game.teams[teamId]) {
      res.json({ success: false, message: 'Bunday guruh bu o\'yinda topilmadi!' });
      return;
    }
    const messages = await store.getChatMessages(pin, `g:${teamId}`);
    res.json({ success: true, roomType: 'group', teamId, messages });
    return;
  }

  // Private room (student <-> teacher).
  if (!isTeacher) {
    if (studentId && studentId !== clientId) {
      res
        .status(403)
        .json({ success: false, message: 'Boshqa o\'quvchi chatiga kirish ruxsati yo\'q!' });
      return;
    }
    if (!student) {
      res.status(401).json({ success: false, message: 'Avval o\'yinga ulanish kerak!' });
      return;
    }
  } else if (!game.students[studentId]) {
    res.json({ success: false, message: 'O\'quvchi topilmadi!' });
    return;
  }

  const roomId = isTeacher ? studentId : clientId;
  const messages = await store.getChatMessages(pin, roomId);
  res.json({ success: true, roomType: 'private', studentId: roomId, messages });
}));

// Serve frontend static files in production. On Vercel this is skipped: the
// static files in dist/ are served by Vercel's edge/CDN (see vercel.json) and
// the api/ function only handles /api/* requests.
if (!IS_VERCEL && process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
