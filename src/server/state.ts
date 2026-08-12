import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { randomBytes, timingSafeEqual } from 'crypto';
import { ChatMessage, GameSession, Question } from '../types.js';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions.js';

// ============================================================
// Storage abstraction.
//
// On Vercel (serverless), the lambda filesystem is ephemeral and the same
// process may not serve consecutive requests, so all mutable game state lives
// in a shared Redis (Vercel KV / Upstash). When no Redis REST env vars are
// configured (local development), an in-memory Map is used instead.
// ============================================================

const USE_REDIS = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const redis = USE_REDIS
  ? new Redis({
      url: process.env.KV_REST_API_URL as string,
      token: process.env.KV_REST_API_TOKEN as string,
    })
  : null;

// 24h is far beyond any real quiz session length; keeps stale keys from piling up.
const KEY_TTL_SECONDS = 60 * 60 * 24;

const KEYS = {
  game: (pin: string) => `rv:game:${pin}`,
  lock: (pin: string) => `rv:lock:${pin}`,
  teacher: (clientId: string) => `rv:teacher:${clientId}`,
  student: (clientId: string) => `rv:student:${clientId}`,
  questions: () => 'rv:questions',
  // Chat rooms. "private" rooms use the student's id as roomId (backward
  // compatible with pre-group keys); "group" rooms use "g:<teamId>".
  chat: (pin: string, roomId: string) => `rv:chat:${pin}:${roomId}`,
  session: (clientId: string) => `rv:session:${clientId}`,
  rateLimit: (key: string) => `rv:rl:${key}`,
};

// ------------------------------------------------------------
// In-memory fallback (local dev)
// ------------------------------------------------------------
const memGames = new Map<string, GameSession>();
const memTeacherPin = new Map<string, string>();
const memStudentPin = new Map<string, string>();
const memLocks = new Map<string, Promise<unknown>>();
const memChats = new Map<string, ChatMessage[]>();
const memSessions = new Map<string, string>();
const memRate = new Map<string, number[]>();

// Per-key promise-chain mutex for the in-memory backend.
async function withMemLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = memLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  memLocks.set(key, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ------------------------------------------------------------
// Game sessions
// ------------------------------------------------------------
export async function getGame(pin: string): Promise<GameSession | null> {
  if (redis) {
    const raw = await redis.get<GameSession | string>(KEYS.game(pin));
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as GameSession;
      } catch {
        return null;
      }
    }
    return raw;
  }
  return memGames.get(pin) ?? null;
}

export async function setGame(pin: string, game: GameSession): Promise<void> {
  if (redis) {
    await redis.set(KEYS.game(pin), JSON.stringify(game), { ex: KEY_TTL_SECONDS });
    return;
  }
  memGames.set(pin, game);
}

export async function deleteGame(pin: string): Promise<void> {
  if (redis) {
    await redis.del(KEYS.game(pin));
    return;
  }
  memGames.delete(pin);
}

export async function listActiveGames(): Promise<number> {
  if (redis) {
    const keys = await redis.keys(`${KEYS.game('*')}`);
    return keys.length;
  }
  return memGames.size;
}

// ------------------------------------------------------------
// Teacher / student -> PIN reverse maps
// ------------------------------------------------------------
export async function getTeacherPin(clientId: string): Promise<string | null> {
  if (redis) {
    const raw = await redis.get<string | number>(KEYS.teacher(clientId));
    return raw == null ? null : String(raw);
  }
  return memTeacherPin.get(clientId) ?? null;
}

export async function setTeacherPin(clientId: string, pin: string): Promise<void> {
  if (redis) {
    await redis.set(KEYS.teacher(clientId), pin, { ex: KEY_TTL_SECONDS });
    return;
  }
  memTeacherPin.set(clientId, pin);
}

export async function deleteTeacherPin(clientId: string): Promise<void> {
  if (redis) {
    await redis.del(KEYS.teacher(clientId));
    return;
  }
  memTeacherPin.delete(clientId);
}

export async function getStudentPin(clientId: string): Promise<string | null> {
  if (redis) {
    const raw = await redis.get<string | number>(KEYS.student(clientId));
    return raw == null ? null : String(raw);
  }
  return memStudentPin.get(clientId) ?? null;
}

export async function setStudentPin(clientId: string, pin: string): Promise<void> {
  if (redis) {
    await redis.set(KEYS.student(clientId), pin, { ex: KEY_TTL_SECONDS });
    return;
  }
  memStudentPin.set(clientId, pin);
}

export async function deleteStudentPin(clientId: string): Promise<void> {
  if (redis) {
    await redis.del(KEYS.student(clientId));
    return;
  }
  memStudentPin.delete(clientId);
}

// Remove every student -> pin mapping that points at the given game (used when
// the PIN changes and all students must re-authenticate).
export async function clearStudentPinsForGame(pin: string): Promise<void> {
  if (redis) {
    const keys = await redis.keys(`${KEYS.student('*')}`);
    if (keys.length === 0) return;
    const values = await redis.mget<string[]>(...keys);
    const toDelete: string[] = [];
    keys.forEach((k, i) => {
      if (String(values[i]) === pin) toDelete.push(k);
    });
    if (toDelete.length > 0) {
      await redis.del(...toDelete);
    }
    return;
  }
  for (const [clientId, mappedPin] of memStudentPin) {
    if (mappedPin === pin) memStudentPin.delete(clientId);
  }
}

// ------------------------------------------------------------
// Chat messages (private student<->teacher rooms and per-group rooms).
//
// roomId is the student id for "private" rooms (unchanged key layout, so old
// stored chats keep working) and "g:<teamId>" for group rooms.
// ------------------------------------------------------------

// Keeps only the most recent messages so a chat key never grows unbounded.
const CHAT_MAX_MESSAGES = 200;

export async function getChatMessages(pin: string, roomId: string): Promise<ChatMessage[]> {
  const key = KEYS.chat(pin, roomId);
  if (redis) {
    const raw = await redis.get<ChatMessage[] | string>(key);
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
    return [];
  }
  return memChats.get(key) ?? [];
}

export async function addChatMessage(
  pin: string,
  roomId: string,
  message: ChatMessage
): Promise<ChatMessage[]> {
  const key = KEYS.chat(pin, roomId);
  if (redis) {
    const existing = await getChatMessages(pin, roomId);
    const next = [...existing, message].slice(-CHAT_MAX_MESSAGES);
    await redis.set(key, JSON.stringify(next), { ex: KEY_TTL_SECONDS });
    return next;
  }
  const existing = memChats.get(key) ?? [];
  const next = [...existing, message].slice(-CHAT_MAX_MESSAGES);
  memChats.set(key, next);
  return next;
}

// ------------------------------------------------------------
// Client session tokens.
//
// A clientId is just a self-generated string (UUID). Anyone who learns another
// person's clientId (network tab, dev tools, a guessed value) could otherwise
// impersonate them. To close that hole, every clientId is bound to an
// unguessable random session token minted by the server at registration time
// (create-game / join-game). Chat endpoints require BOTH the clientId and its
// matching token; the pairing is verified here.
// ------------------------------------------------------------

// 32 random bytes, hex-encoded = 64 characters. crypto.randomBytes is
// cryptographically strong, so the token is unguessable by an attacker.
function mintSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Constant-time comparison so a timing side-channel cannot leak the token.
function tokensMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function getSessionToken(clientId: string): Promise<string | null> {
  const key = KEYS.session(clientId);
  if (redis) {
    const raw = await redis.get<string | number>(key);
    return raw == null ? null : String(raw);
  }
  return memSessions.get(key) ?? null;
}

export async function setSessionToken(clientId: string, token: string): Promise<void> {
  const key = KEYS.session(clientId);
  if (redis) {
    await redis.set(key, token, { ex: KEY_TTL_SECONDS });
    return;
  }
  memSessions.set(key, token);
}

// Mint (or reuse) a session token for a client. Reusing an existing token keeps
// a browser session stable across reconnects; only mint when none exists.
export async function createSessionToken(clientId: string): Promise<string> {
  const existing = await getSessionToken(clientId);
  if (existing) return existing;
  const token = mintSessionToken();
  await setSessionToken(clientId, token);
  return token;
}

export async function deleteSessionToken(clientId: string): Promise<void> {
  const key = KEYS.session(clientId);
  if (redis) {
    await redis.del(key);
    return;
  }
  memSessions.delete(key);
}

// ------------------------------------------------------------
// Backward compatibility for clientIds minted BEFORE session tokens existed.
//
// Tokens are issued by create-game / join-game. A browser that logged in before
// this feature shipped has a clientId in localStorage but no token, and it has
// no way to obtain one without re-creating/re-joining the game. To avoid
// locking those users out on the day of deploy we allow token-less requests for
// a grace period, but ONLY when the clientId is (a) an old-format clientId and
// (b) already registered in the store (teacher or student pin exists). A random
// attacker-generated UUID is NOT registered, so it is still rejected even
// during the grace window.
//
// The grace window defaults to 30 days after first boot. Operators can
// override it with CHAT_LEGACY_TOKEN_GRACE_UNTIL (unix millis or an ISO date).
// MIGRATION: deploy this version, then after 30 days (or once all active
// browsers have re-registered, which happens automatically on their next
// create-game/join-game), set CHAT_LEGACY_TOKEN_GRACE_UNTIL=0 and deploy again
// to turn the legacy path off for good.
function legacyGraceUntil(): number {
  const raw = process.env.CHAT_LEGACY_TOKEN_GRACE_UNTIL;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
    const d = Date.parse(raw);
    if (!Number.isNaN(d)) return d;
  }
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

const LEGACY_GRACE_UNTIL = legacyGraceUntil();

// Old-format clientIds: crypto.randomUUID() or the id_<ts>_<rand> fallback that
// getClientId() in src/utils/api.ts has always produced.
const LEGACY_CLIENT_ID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|id_\d+_[a-z0-9]+)$/i;

export interface SessionVerdict {
  ok: boolean;
  status: number;
  message: string;
  legacy?: boolean;
}

export async function verifyClientSession(
  clientId: string,
  presentedToken: string | null
): Promise<SessionVerdict> {
  const stored = await getSessionToken(clientId);
  if (stored) {
    if (presentedToken && tokensMatch(stored, presentedToken)) {
      return { ok: true, status: 200, message: '' };
    }
    return {
      ok: false,
      status: 401,
      message: 'Avtorizatsiya tokeni noto\'g\'ri yoki muddati tugagan!',
    };
  }

  // No token on record for this clientId: it predates session tokens.
  if (Date.now() < LEGACY_GRACE_UNTIL && LEGACY_CLIENT_ID_REGEX.test(clientId)) {
    const known =
      (await getTeacherPin(clientId)) !== null || (await getStudentPin(clientId)) !== null;
    if (known) {
      console.warn(
        `[session] Legacy token-less clientId "${clientId}" allowed during migration grace period`
      );
      return { ok: true, status: 200, message: '', legacy: true };
    }
  }

  return {
    ok: false,
    status: 401,
    message: 'Ushbu foydalanuvchi ro\'yxatdan o\'tmagan!',
  };
}

// ------------------------------------------------------------
// Rate limiting (fixed window).
//
// Simple, dependency-free: an in-memory sliding-window list on the local
// backend and a fixed-window INCR+EXPIRE counter on Redis. Used to throttle
// /api/chat/send per clientId so a single client cannot flood the chat.
// ------------------------------------------------------------
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  if (redis) {
    const rk = KEYS.rateLimit(key);
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const count = await redis.incr(rk);
    if (count === 1) {
      await redis.expire(rk, windowSec);
    }
    if (count > limit) {
      const ttl = await redis.ttl(rk);
      return { allowed: false, retryAfterMs: Math.max(1, ttl) * 1000 };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  const timestamps = (memRate.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    const retryAfterMs = Math.max(1, timestamps[0] + windowMs - now);
    return { allowed: false, retryAfterMs };
  }
  timestamps.push(now);
  memRate.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

// ------------------------------------------------------------
// Questions database
// ------------------------------------------------------------
const QUESTIONS_FILE_PATH = path.join(process.cwd(), 'questions_db.json');

export async function loadQuestions(): Promise<Question[]> {
  if (redis) {
    const raw = await redis.get<Question[] | string>(KEYS.questions());
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through to defaults
      }
    }
  }
  try {
    if (fs.existsSync(QUESTIONS_FILE_PATH)) {
      const data = fs.readFileSync(QUESTIONS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading questions database:', err);
  }
  return [...DEFAULT_QUESTIONS];
}

export async function saveQuestions(questions: Question[]): Promise<void> {
  if (redis) {
    await redis.set(KEYS.questions(), JSON.stringify(questions));
    return;
  }
  // On serverless there is no writable filesystem, so this only runs locally.
  if (process.env.VERCEL === '1') return;
  try {
    fs.writeFileSync(QUESTIONS_FILE_PATH, JSON.stringify(questions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving questions database:', err);
  }
}

// ------------------------------------------------------------
// Per-game lock: serializes read-modify-write on a game session so
// concurrent requests (e.g. several students joining at once) cannot
// clobber each other's mutations.
// ------------------------------------------------------------
export interface GameOpResult<T = void> {
  ok: boolean;
  message?: string;
  game?: GameSession;
  data?: T;
}

export async function withGameLock<T = void>(
  pin: string,
  fn: (game: GameSession) => GameOpResult<T> | Promise<GameOpResult<T>>
): Promise<GameOpResult<T> | null> {
  if (redis) {
    const lockKey = KEYS.lock(pin);
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    let acquired = false;
    for (let i = 0; i < 40; i++) {
      const setRes = await redis.set(lockKey, token, { nx: true, px: 5000 });
      if (setRes === 'OK') {
        acquired = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (!acquired) return null;

    try {
      const game = await getGame(pin);
      if (!game) return null;
      const result = await fn(game);
      if (result.ok) {
        await setGame(pin, game);
      }
      return result;
    } finally {
      const UNLOCK_SCRIPT =
        `if redis.call('get', KEYS[1]) == ARGV[1] then ` +
        `return redis.call('del', KEYS[1]) else return 0 end`;
      await redis.eval(UNLOCK_SCRIPT, [lockKey], [token]);
    }
  }

  return withMemLock(`lock:${pin}`, async () => {
    const game = await getGame(pin);
    if (!game) return null;
    const result = await fn(game);
    if (result.ok) {
      await setGame(pin, game);
    }
    return result;
  });
}
