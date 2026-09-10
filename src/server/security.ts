import type { Request, Response } from 'express';
import { GameSession } from '../types.js';
import * as store from './state.js';

// ============================================================
// Security layer: rate limits, PIN lifetime and session-token
// verification shared by the REST endpoints in app.ts.
//
// The token is a 64-char lowercase hex string (32 random bytes). Clients
// present it either as an `Authorization: Bearer ...` header (JSON API calls)
// or as a `sessionToken` field (pusher-js form posts). Without a matching token
// a stolen clientId is useless, closing the clientId-spoofing hole.
// ============================================================

export const SESSION_TOKEN_REGEX = /^[0-9a-f]{64}$/;

// Chat rate limit: per clientId, at most N messages per fixed window. The
// defaults (20 / 60s) are generous for a classroom chat but stop a single
// script from flooding every student's inbox. Overridable via env vars.
export const CHAT_RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX ?? 20);
export const CHAT_RATE_LIMIT_WINDOW_MS =
  (Number(process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000;

// Join rate limit: how many failed PIN join attempts a single IP may make per
// window before further attempts are temporarily blocked (429). Guards against
// brute-forcing the 6-digit PIN. Env-overridable like the chat limit.
export const JOIN_ATTEMPT_LIMIT = Number(process.env.JOIN_ATTEMPT_LIMIT ?? 10);
export const JOIN_ATTEMPT_WINDOW_MS =
  (Number(process.env.JOIN_ATTEMPT_WINDOW_SECONDS) || 60) * 1000;

// Create-game rate limit: a session is minted (and a token issued) on every
// /api/create-game call, so it is the single cheapest way to flood the store
// with games. Bound it per IP — a classroom teacher creates a handful of games
// per session, never hundreds in ten minutes. Env-overridable like the others.
export const CREATE_GAME_LIMIT = Number(process.env.CREATE_GAME_LIMIT ?? 120);
export const CREATE_GAME_WINDOW_MS =
  (Number(process.env.CREATE_GAME_WINDOW_MINUTES) || 10) * 60 * 1000;

// Hard lifetime of a game PIN. After this many milliseconds from creation the
// PIN stops accepting joins (treated exactly like "no such game"), which (a)
// bounds the window in which the 6-digit PIN can be brute-forced and (b) stops
// zombie games from being joinable forever. Alive games are unaffected; the
// presence sweep already ends games whose teacher went silent.
export const PIN_LIFETIME_MS = (Number(process.env.PIN_LIFETIME_HOURS) || 2) * 60 * 60 * 1000;

export function isPinExpired(game: GameSession | null): boolean {
  if (!game) return true;
  const expiresAt = game.pinExpiresAt;
  if (typeof expiresAt !== 'number') return false; // legacy/fixture games never expire
  return Date.now() > expiresAt;
}

// Best-effort client IP. On Vercel req.ip is populated by the platform; behind
// the local Vite dev proxy we fall back to the X-Forwarded-For header, then to
// a fixed key so local requests still share (and are throttled by) one bucket.
export function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (Array.isArray(xff)) return xff[0];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
  return 'local';
}

export function extractSessionToken(req: Request): string | null {
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

export function looksLikeSessionToken(token: string | null): boolean {
  return typeof token === 'string' && SESSION_TOKEN_REGEX.test(token);
}

// Shared gate for /api/pusher/auth, /api/chat/send and /api/chat/messages.
// Returns null when the client is authorized, or a JSON-ready rejection to send.
export type ChatAuthError = { status: number; body: Record<string, unknown> } | null;

export async function verifyChatClient(
  req: Request,
  clientId: string
): Promise<ChatAuthError> {
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

// Gate for teacher-only endpoints. The caller must present a valid session
// token so a stolen teacher clientId cannot alone act on a game. (The "this
// client owns the requested game" identity check is a separate concern handled
// by getTeacherGame at each call site.)
export async function requireTeacherAuth(
  req: Request,
  clientId: string
): Promise<ChatAuthError> {
  return verifyChatClient(req, clientId);
}

// Respond with the rejection produced by verifyChatClient/requireTeacherAuth,
// and return whether the caller must abort the request.
export function respondAuthError(res: Response, error: ChatAuthError): boolean {
  if (error) {
    res.status(error.status).json(error.body);
    return true;
  }
  return false;
}