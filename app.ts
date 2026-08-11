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

const app = express();

app.use(express.json());

// Vercel serverless functions run on an ephemeral, read-only filesystem and are
// bundled into a lambda. All persistent game state is kept in Redis (Vercel KV
// / Upstash) when KV_REST_API_* env vars are present; otherwise an in-memory
// store is used for local development. Static file serving is handled by
// Vercel's CDN (see vercel.json); see the guard at the bottom of this file.
const IS_VERCEL = process.env.VERCEL === '1';

// Pusher Channels instance
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '2185025',
  key: process.env.PUSHER_KEY || '307958d4cd4d6d38e210',
  secret: process.env.PUSHER_SECRET || '4427b2ff1430ab587020',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
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

// Helper: Trigger an event on a game channel via Pusher
function emitToGame(pin: string, event: string, data: unknown) {
  pusher
    .trigger(`game-${pin}`, event, data)
    .catch((err) => {
      console.error(`Pusher trigger error (${event} -> ${pin}):`, err);
    });
}

// Helper: Broadcast the full game state to a game channel
function broadcastGameState(pin: string, game: GameSession) {
  emitToGame(pin, 'game_state', game);
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

  await store.setGame(pin, newGame);
  await store.setTeacherPin(clientId, pin);

  console.log(`Yangi o'yin seansi yaratildi! PIN: ${pin}`);

  broadcastGameState(pin, newGame);
  res.json({ success: true, pin, game: newGame });
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

  const r = await store.withGameLock(pin, (game) => {
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
      }
      existingStudent.id = clientId;
      existingStudent.connected = true;
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

  broadcastGameState(pin, r.game);
  res.json({ success: true, studentId: clientId, game: r.game });
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
    return { ok: true, game };
  });

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
      return { ok: false, game };
    }

    const penalty = req.body?.points || 5;
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

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);

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

  broadcastGameState(context.pin, r.game);
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
    broadcastGameState(pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
    const team = game.teams[req.body?.teamId];
    if (!team || team.currentBet === null) {
      return { ok: false, game };
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

  if (!r || !r.game || !r.ok) {
    res.json({ success: false });
    return;
  }
  broadcastGameState(context.pin, r.game);
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
      game.phase = 'ROUND_RESULT';
    }
    game.isTimerRunning = false;

    return { ok: true, game };
  });

  if (!r || !r.game) {
    res.json({ success: false });
    return;
  }
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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
  broadcastGameState(context.pin, r.game);
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

  await store.setGame(newPin, newGame);
  await store.setTeacherPin(clientId, newPin);

  console.log(`Yangi o'yin boshlandi! Yangi PIN: ${newPin}`);
  broadcastGameState(newPin, newGame);
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
  broadcastGameState(context.pin, r.game);
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
  emitToGame(currentPin as string, 'kicked_out', 'Parolni xato kiritdingiz');
  emitToGame(currentPin as string, 'error_message', 'Parolni xato kiritdingiz');

  // Transfer game to new PIN key and clear student list so they re-authenticate
  await store.deleteGame(currentPin as string);
  game.pin = cleanPin;
  game.students = {};
  await store.setGame(cleanPin, game);

  // Clear student pin mappings for the old game
  await store.clearStudentPinsForGame(currentPin as string);

  // Re-map teacher client
  await store.setTeacherPin(clientId, cleanPin);

  console.log(`PIN-kod (parol) o'zgartirildi va o'quvchilar chiqarildi: ${currentPin} -> ${cleanPin}`);
  broadcastGameState(cleanPin, game);
  res.json({ success: true, pin: cleanPin, game });
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
  broadcastGameState(context.pin, r.game);
  emitToGame(context.pin, 'notification', {
    type: 'success',
    text: `${r.data?.studentName} o'yin haqida fikr bildirdi!`,
  });
  res.json({ success: true });
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
