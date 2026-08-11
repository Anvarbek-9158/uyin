import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { GameSession, Question } from '../types.js';
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
};

// ------------------------------------------------------------
// In-memory fallback (local dev)
// ------------------------------------------------------------
const memGames = new Map<string, GameSession>();
const memTeacherPin = new Map<string, string>();
const memStudentPin = new Map<string, string>();
const memLocks = new Map<string, Promise<unknown>>();

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
    const raw = await redis.get<string>(KEYS.game(pin));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GameSession;
    } catch {
      return null;
    }
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
  if (redis) return redis.get<string>(KEYS.teacher(clientId));
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
  if (redis) return redis.get<string>(KEYS.student(clientId));
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
      if (values[i] === pin) toDelete.push(k);
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
// Questions database
// ------------------------------------------------------------
const QUESTIONS_FILE_PATH = path.join(process.cwd(), 'questions_db.json');

export async function loadQuestions(): Promise<Question[]> {
  if (redis) {
    const raw = await redis.get<string>(KEYS.questions());
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
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
