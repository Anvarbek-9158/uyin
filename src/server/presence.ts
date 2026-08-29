// Server-side presence sweeper (QISM D / F / G).
//
// Presence is backend-authoritative: the server tracks the last time the
// teacher and every student reported in (see GameSession.teacherLastSeenAt and
// Student.lastSeenAt). There are no hard disconnect guarantees in any
// realtime stack (a dropped network link produces no close event), so a
// heartbeat + grace-period heuristic is the accepted mechanism — the same one
// WebSockets clients rely on. The sweeper below is pure (no store / no pusher)
// so it can be unit-tested with a fake clock; the HTTP layer in app.ts runs it
// inside the per-game lock, persists the deletions, and broadcasts the result.

import { GameSession } from '../types.js';

// Milliseconds a teacher may go silent before the game is auto-ended.
export function teacherPresenceGraceMs(): number {
  const n = Number(process.env.PRESENCE_TEACHER_GRACE_MS);
  return Number.isFinite(n) && n > 0 ? n : 45_000;
}

// Milliseconds a student may go silent before they are removed from the game
// (and their team, handing leadership over if needed).
export function studentPresenceGraceMs(): number {
  const n = Number(process.env.PRESENCE_STUDENT_GRACE_MS);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

// Number of questions that make up one "raund" (QISM H). Scores stay
// cumulative across rounds; only the round counter advances. The default is a
// single question per round (each question = one raund); overridable via env.
export function questionsPerRound(): number {
  const n = Number(process.env.QUESTIONS_PER_ROUND);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export interface RemovedStudent {
  id: string;
  name: string;
}

export interface PresenceSweepResult {
  teacherEnded: boolean;
  removedStudents: RemovedStudent[];
}

function removeStudentFromGame(game: GameSession, studentId: string): void {
  const student = game.students[studentId];
  if (!student) return;
  if (student.teamId && game.teams[student.teamId]) {
    const team = game.teams[student.teamId];
    team.memberIds = team.memberIds.filter((id) => id !== studentId);
    // Hand the leader role to the first remaining member so a team is never
    // left leaderless when its leader goes silent mid-game (QISM G).
    if (team.leaderClientId === studentId) {
      team.leaderClientId = team.memberIds[0] || null;
      if (team.leaderClientId && game.students[team.leaderClientId]) {
        game.students[team.leaderClientId].isLeader = true;
      }
    }
  }
  delete game.students[studentId];
}

// Mutates `game` in place based on who has gone stale at time `now`. Returns
// what changed so the caller can clean up store keys and broadcast.
export function applyPresenceSweep(game: GameSession, now: number): PresenceSweepResult {
  const result: PresenceSweepResult = { teacherEnded: false, removedStudents: [] };

  if (!game || game.phase === 'GAME_OVER') return result;

  // Teacher gone -> the game ends (QISM F). The game object is kept (never
  // deleted) so the teacher can come back and reset/replay it.
  const teacherSeen = game.teacherLastSeenAt;
  if (teacherSeen && now - teacherSeen > teacherPresenceGraceMs()) {
    game.phase = 'GAME_OVER';
    game.isTimerRunning = false;
    result.teacherEnded = true;
    return result;
  }

  const grace = studentPresenceGraceMs();
  const stale = Object.entries(game.students)
    .filter(([, student]) => !!student.lastSeenAt && now - student.lastSeenAt > grace)
    .map(([id, student]) => ({ id, name: student.name }));
  for (const { id } of stale) {
    removeStudentFromGame(game, id);
  }
  result.removedStudents = stale;

  return result;
}
