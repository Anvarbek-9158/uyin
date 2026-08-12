import 'dotenv/config';
import express from 'express';
import path from 'path';
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

const app = express();

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
// PUSHER_HOST/PUSHER_PORT/PUSHER_TIMEOUT are optional overrides (self-hosted
// Channels-compatible servers, or fast-fail local testing).
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '2185025',
  key: process.env.PUSHER_KEY || '307958d4cd4d6d38e210',
  secret: process.env.PUSHER_SECRET || '4427b2ff1430ab587020',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
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

// Helper: Broadcast the full game state to a game channel. Awaited at every call
// site so the state is persisted AND the event is actually sent before the
// response goes out.
async function broadcastGameState(pin: string, game: GameSession): Promise<void> {
  await emitToGame(pin, 'game_state', game);
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
  game.teacherLastSeenAt = Date.now();
  return game;
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
// ============================================================

// The token is a 64-char lowercase hex string (32 random bytes).
const SESSION_TOKEN_REGEX = /^[0-9a-f]{64}$/;

// Chat rate limit: per clientId, at most N messages per fixed window. The
// defaults (20 / 60s) are generous for a classroom chat but stop a single
// script from flooding every student's inbox. Overridable via env vars.
const CHAT_RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX ?? 20);
const CHAT_RATE_LIMIT_WINDOW_MS = (Number(process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000;

function extractSessionToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const body = (req.body as Record<string, unknown> | undefined)?.sessionToken;
  if (typeof body === 'string' && body) return body;
  const query = (req.query as Record<string, unknown> | undefined)?.sessionToken;
  if (typeof query === 'string' && query) return query;
  return null;
}

function looksLikeSessionToken(token: string | null): boolean {
  return typeof token === 'string' && SESSION_TOKEN_REGEX.test(token);
}

// Shared gate for /api/pusher/auth, /api/chat/send and /api/chat/messages.
// Returns null when the client is authorized, or a JSON-ready rejection to send.
type ChatAuthError = { status: number; body: Record<string, unknown> } | null;

async function verifyChatClient(req: Request, clientId: string): Promise<ChatAuthError> {
  if (!clientId) {
    return { status: 400, body: { success: false, message: 'clientId topilmadi!' } };
  }
  const presentedToken = extractSessionToken(req);
  // Reject malformed tokens outright instead of comparing them: this also
  // protects the store against junk lookups.
  if (presentedToken !== null && !looksLikeSessionToken(presentedToken)) {
    return {
      status: 401,
      body: { success: false, message: 'Avtorizatsiya tokeni noto\'g\'ri formatda!' },
    };
  }
  const verdict = await store.verifyClientSession(clientId, presentedToken);
  if (!verdict.ok) {
    return { status: verdict.status, body: { success: false, message: verdict.message } };
  }
  return null;
}

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
      res.json({ success: true, game: r.game });
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
  const name = (req.body?.name || '').toString().trim();

  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  const r = await store.withGameLock(pin, async (game) => {
    // Check name collision in game
    const existingStudent = Object.values(game.students).find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );

    if (existingStudent) {
      // Reconnect student: remove the stale entry under the old client id
      // so the same student is NOT duplicated in the game.
      const oldId = existingStudent.id;
      if (oldId && oldId !== clientId) {
        delete game.students[oldId];
        // The abandoned clientId must not remain able to act on this game.
        await store.deleteSessionToken(oldId);
      }
      existingStudent.id = clientId;
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

  if (!r || !r.game) {
    res.json({
      success: false,
      message: `Bunday PIN-kodli faol o'yin topilmadi! Iltimos, o'qituvchidan PIN-kodni qayta surishtiring.`,
    });
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
  res.json({ success: true, studentId: clientId, game: r.game, sessionToken });
}));

// 3. TEACHER: Create a Team
app.post('/api/create-team', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
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
      name: req.body?.name || `Guruh ${teamCount + 1}`,
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

// 6. TEACHER: Set explicit Team Leader
app.post('/api/set-team-leader', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
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
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const questionIndex = req.body?.questionIndex;
    const qIndex = typeof questionIndex === 'number' && questionIndex >= 0 && questionIndex < game.questions.length
      ? questionIndex
      : (game.currentQuestionIndex || 0);

    game.currentQuestionIndex = qIndex;
    const currentQ = game.questions[qIndex];
    game.timerSeconds = currentQ?.timeLimit || 30;
    game.phase = 'BETTING';
    game.isTimerRunning = false;
    // Count questions started inside the current round (QISM H). The round
    // advances in /api/finish-round once questionsPlayedInRound reaches the
    // questionsPerRound boundary.
    game.questionsPlayedInRound = (game.questionsPlayedInRound ?? 0) + 1;

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
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    const activeTeams = Object.values(game.teams).filter((t) => !t.isEliminated);
    const unbetTeams = activeTeams.filter((t) => t.currentBet === null);

    if (activeTeams.length > 0 && unbetTeams.length > 0) {
      return {
        ok: false,
        message: `Hali barcha guruhlar ball tikmadi! (${activeTeams.length - unbetTeams.length}/${activeTeams.length} guruh tikdi)`,
      };
    }

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
  }
  res.json({ success: true });
}));

// 11. TEACHER: Manually Stop Answering Phase
app.post('/api/stop-answering-phase', ah(async (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
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

    // Check if game is over (only 1 non-eliminated team left or all questions completed)
    const activeTeams = Object.values(game.teams).filter((t) => !t.isEliminated);
    if (
      activeTeams.length <= 1 ||
      game.currentQuestionIndex >= game.questions.length - 1
    ) {
      game.phase = 'GAME_OVER';
    } else {
      // Advance the round once the current round's question budget is spent
      // (QISM H). Scores stay cumulative; only the round counter moves.
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
  const context = await getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const r = await store.withGameLock(context.pin, (game) => {
    if (game.currentQuestionIndex < game.questions.length - 1) {
      const nextIdx = game.currentQuestionIndex + 1;
      game.currentQuestionIndex = nextIdx;
      game.timerSeconds = game.questions[nextIdx]?.timeLimit || 30;
      game.phase = 'BETTING';
      game.isTimerRunning = false;

      Object.values(game.teams).forEach((team) => {
        team.currentBet = null;
        team.currentAnswer = null;
        team.answerSubmittedAt = null;
        team.lastResult = null;
      });
    } else {
      game.phase = 'GAME_OVER';
      game.isTimerRunning = false;
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
  const cleanPin = (req.body?.newPin || '').toString().trim().toUpperCase();
  if (!cleanPin || cleanPin.length !== 6) {
    res.json({ success: false, message: `O'yin PIN-kodi (paroli) rosa 6 xonali bo'lishi shart!` });
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
      rating: (req.body?.rating || "A'lo") as 'Yaxshi' | 'Yomon' | "A'lo",
      comment: (req.body?.comment || '').toString().trim(),
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
  let role: 'teacher' | 'student';
  let senderName: string;
  let roomType: 'private' | 'group';
  let roomId: string; // studentId for private rooms, teamId for group rooms

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
