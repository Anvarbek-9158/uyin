import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import Pusher from 'pusher';
import {
  GameSession,
  Question,
  Student,
  Team,
  GamePhase,
} from './src/types.js';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.js';

const app = express();

app.use(express.json());

// Vercel serverless functions run on an ephemeral, read-only filesystem and are
// bundled into a lambda. Persistent file writes and static file serving are
// handled differently there (see guards below).
const IS_VERCEL = process.env.VERCEL === '1';

// Pusher Channels instance
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '2185025',
  key: process.env.PUSHER_KEY || '307958d4cd4d6d38e210',
  secret: process.env.PUSHER_SECRET || '4427b2ff1430ab587020',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
});

// Persistent Questions File Storage
const QUESTIONS_FILE_PATH = path.join(process.cwd(), 'questions_db.json');

function loadSavedQuestions(): Question[] {
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

function saveQuestionsToFile(questions: Question[]) {
  if (IS_VERCEL) {
    return;
  }
  try {
    fs.writeFileSync(QUESTIONS_FILE_PATH, JSON.stringify(questions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving questions database:', err);
  }
}

// In-Memory Games Repository
// Key: 6-digit PIN code -> GameSession
const games: Record<string, GameSession> = {};
// Map client ID -> PIN code (teachers only)
const teacherPinMap: Record<string, string> = {};
// Map client ID -> PIN code (students only)
const studentPinMap: Record<string, string> = {};
// Map PIN -> Timer Interval
const gameTimers: Record<string, NodeJS.Timeout> = {};

// Helper: Generate unique 6-digit PIN
function generateUniquePin(): string {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games[pin]);
  return pin;
}

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

// Helper: Trigger an event on a game channel via Pusher
function emitToGame(pin: string, event: string, data: unknown) {
  pusher
    .trigger(`game-${pin}`, event, data)
    .catch((err) => {
      console.error(`Pusher trigger error (${event} -> ${pin}):`, err);
    });
}

// Helper: Broadcast game state to game channel
function broadcastGameState(pin: string) {
  const game = games[pin];
  if (game) {
    emitToGame(pin, 'game_state', game);
  }
}

// Helper: Clear game timer
function stopTimer(pin: string) {
  if (gameTimers[pin]) {
    clearInterval(gameTimers[pin]);
    delete gameTimers[pin];
  }
  if (games[pin]) {
    games[pin].isTimerRunning = false;
  }
}

// Helper: Start timer for question answering phase
function startQuestionTimer(pin: string) {
  stopTimer(pin);
  const game = games[pin];
  if (!game) return;

  game.isTimerRunning = true;
  broadcastGameState(pin);

  gameTimers[pin] = setInterval(() => {
    if (!games[pin]) {
      stopTimer(pin);
      return;
    }

    games[pin].timerSeconds -= 1;
    emitToGame(pin, 'timer_tick', games[pin].timerSeconds);

    if (games[pin].timerSeconds <= 0) {
      stopTimer(pin);
      games[pin].phase = 'GRADING';
      broadcastGameState(pin);
      emitToGame(pin, 'notification', {
        type: 'warning',
        text: `Vaqt tugadi! Javoblar qabul qilish to'xtatildi.`,
      });
    }
  }, 1000);
}

// REST API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeGames: Object.keys(games).length });
});

// ============================================================
// REST API + Pusher Channels (Socket.io replaced)
// ============================================================

// Helper: Get teacher's game (validates client is the game host)
function getTeacherGame(clientId: string): { pin: string; game: GameSession } | null {
  const pin = teacherPinMap[clientId];
  const game = games[pin];
  if (!game || game.teacherClientId !== clientId) return null;
  return { pin, game };
}

// Helper: Get student's game by their clientId
function getStudentGame(clientId: string): { pin: string; game: GameSession; student: Student } | null {
  const pin = studentPinMap[clientId];
  const game = games[pin];
  const student = game?.students[clientId];
  if (!game || !student) return null;
  return { pin, game, student };
}

// 1. TEACHER: Create new game session (or reset)
app.post('/api/create-game', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  // Clean up old game if this client was host elsewhere
  const oldPin = teacherPinMap[clientId];
  if (oldPin && games[oldPin]) {
    emitToGame(oldPin, 'kicked_out', 'Parolni xato kiritdingiz');
    emitToGame(oldPin, 'error_message', 'Parolni xato kiritdingiz');
    stopTimer(oldPin);
    delete games[oldPin];
  }

  const pin = generateUniquePin();
  const initialQuestions = loadSavedQuestions();
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

  games[pin] = newGame;
  teacherPinMap[clientId] = pin;

  console.log(`Yangi o'yin seansi yaratildi! PIN: ${pin}`);

  broadcastGameState(pin);
  res.json({ success: true, pin, game: newGame });
});

// 2. STUDENT: Join existing game via PIN & Name
app.post('/api/join-game', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const pin = (req.body?.pin || '').toString().trim();
  const name = (req.body?.name || '').toString().trim();

  if (!clientId) {
    res.json({ success: false, message: 'clientId topilmadi!' });
    return;
  }

  const game = games[pin];
  if (!game) {
    res.json({
      success: false,
      message: `Bunday PIN-kodli faol o'yin topilmadi! Iltimos, o'qituvchidan PIN-kodni qayta surishtiring.`,
    });
    return;
  }

  // Check name collision in game
  const existingStudent = Object.values(game.students).find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );

  let studentId = clientId;

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

  studentPinMap[clientId] = pin;

  if (game.phase !== 'LOBBY' && game.phase !== 'TEAMS_SETUP') {
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

  broadcastGameState(pin);
  res.json({ success: true, studentId, game });
});

// 3. TEACHER: Create a Team
app.post('/api/create-team', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Avval o'yin yaratish kerak!` });
    return;
  }

  const { pin, game } = context;
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
  broadcastGameState(pin);
  res.json({ success: true });
});

// 4. TEACHER: Delete a Team
app.post('/api/delete-team', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
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
    broadcastGameState(pin);
  }
  res.json({ success: true });
});

// 5. TEACHER: Assign Student to Team
app.post('/api/assign-student', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const studentId = req.body?.studentId;
  const teamId = req.body?.teamId || null;
  const student = game.students[studentId];
  if (!student) {
    res.json({ success: false });
    return;
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

  broadcastGameState(pin);
  res.json({ success: true });
});

// 5b. TEACHER: Bulk Assign Students to Team
app.post('/api/bulk-assign-students', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
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

  broadcastGameState(pin);
  res.json({ success: true });
});

// 5c. TEACHER: Kick / Remove student from game
app.post('/api/kick-student', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const studentId = req.body?.studentId;
  const student = game.students[studentId];
  if (!student) {
    res.json({ success: false });
    return;
  }

  if (student.teamId && game.teams[student.teamId]) {
    const team = game.teams[student.teamId];
    team.memberIds = team.memberIds.filter((id) => id !== studentId);
    if (team.leaderClientId === studentId) {
      team.leaderClientId = team.memberIds[0] || null;
    }
  }

  delete game.students[studentId];
  delete studentPinMap[studentId];
  broadcastGameState(pin);
  res.json({ success: true });
});

// 6. TEACHER: Set explicit Team Leader
app.post('/api/set-team-leader', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const studentId = req.body?.studentId;
  const teamId = req.body?.teamId;
  const team = game.teams[teamId];
  if (!team) {
    res.json({ success: false });
    return;
  }

  // Unset current leader in team
  team.memberIds.forEach((id) => {
    if (game.students[id]) {
      game.students[id].isLeader = id === studentId;
    }
  });

  team.leaderClientId = studentId;
  broadcastGameState(pin);
  res.json({ success: true });
});

// 6b. TEACHER: Penalize Team (-5 points for noise/disruption)
app.post('/api/penalize-team', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const team = game.teams[req.body?.teamId];
  if (!team) {
    res.json({ success: false });
    return;
  }

  const penalty = req.body?.points || 5;
  team.score = Math.max(0, team.score - penalty);
  if (team.score <= 0) {
    team.isEliminated = true;
  }

  broadcastGameState(pin);
  emitToGame(pin, 'notification', {
    type: 'warning',
    text: `${team.name} jamoasidan ${req.body?.reason || 'shovqin qilgani uchun'} -${penalty} ball olindi! Joriy ball: ${team.score}`,
  });
  res.json({ success: true });
});

// 7. TEACHER: Set Question Database
app.post('/api/set-questions', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const questions: Question[] = req.body?.questions || [];
  game.questions = questions;
  game.currentQuestionIndex = 0;
  game.timerSeconds = questions[0]?.timeLimit || 30;
  saveQuestionsToFile(questions);
  broadcastGameState(pin);
  res.json({ success: true });
});

// 8. TEACHER: Start Betting Phase for a Question
app.post('/api/start-betting-phase', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  stopTimer(pin);

  const questionIndex = req.body?.questionIndex;
  const qIndex = typeof questionIndex === 'number' && questionIndex >= 0 && questionIndex < game.questions.length
    ? questionIndex
    : (game.currentQuestionIndex || 0);

  game.currentQuestionIndex = qIndex;
  const currentQ = game.questions[qIndex];
  game.timerSeconds = currentQ?.timeLimit || 30;
  game.phase = 'BETTING';

  // Reset current bets and answers for all non-eliminated teams
  Object.values(game.teams).forEach((team) => {
    team.currentBet = null;
    team.currentAnswer = null;
    team.answerSubmittedAt = null;
    team.lastResult = null;
  });

  broadcastGameState(pin);
  emitToGame(pin, 'notification', {
    type: 'info',
    text: 'Savol ekranga chiqdi! Jamoalar ball tikishni boshlang.',
  });
  res.json({ success: true });
});

// 9. TEAM LEADER: Place Bet
app.post('/api/place-bet', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getStudentGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }

  const { pin, game, student } = context;
  if (game.phase !== 'BETTING') {
    res.json({ success: false, message: 'Hozir ball tikish vaqti emas!' });
    return;
  }

  if (!student.teamId || !student.isLeader) {
    res.json({ success: false, message: `Faqat Guruh Boshlig'i (Sardor) ball tika oladi!` });
    return;
  }

  const team = game.teams[student.teamId];
  if (!team || team.isEliminated) {
    res.json({ success: false, message: `Sizning jamoangiz o'yindan chiqqan!` });
    return;
  }

  const numericBet = Math.floor(Number(req.body?.bet));
  if (isNaN(numericBet) || numericBet < 1 || numericBet > team.score) {
    res.json({
      success: false,
      message: `Tikiladigan ball 1 va jamoaning mavjud bali (${team.score}) oralig'ida bo'lishi shart!`,
    });
    return;
  }

  team.currentBet = numericBet;
  broadcastGameState(pin);

  emitToGame(pin, 'bet_placed', { teamId: team.id, bet: numericBet });
  emitToGame(pin, 'notification', {
    type: 'success',
    text: `${team.name} jamoasi ${numericBet} ball tikdi!`,
  });
  res.json({ success: true });
});

// 10. TEACHER: Click "Boshlash" to enable answering & timer
app.post('/api/start-answering-phase', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const activeTeams = Object.values(game.teams).filter((t) => !t.isEliminated);
  const unbetTeams = activeTeams.filter((t) => t.currentBet === null);

  if (activeTeams.length > 0 && unbetTeams.length > 0) {
    res.json({
      success: false,
      message: `Hali barcha guruhlar ball tikmadi! (${activeTeams.length - unbetTeams.length}/${activeTeams.length} guruh tikdi)`,
    });
    return;
  }

  const currentQ = game.questions[game.currentQuestionIndex];
  game.timerSeconds = currentQ?.timeLimit || 30;
  game.phase = 'ANSWERING';

  broadcastGameState(pin);
  startQuestionTimer(pin);

  emitToGame(pin, 'notification', {
    type: 'info',
    text: `O'qituvchi taymerni boshladi! Guruh sardorlari javob kiritishi mumkin!`,
  });
  res.json({ success: true });
});

// 11. TEACHER: Manually Stop Answering Phase
app.post('/api/stop-answering-phase', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  stopTimer(pin);
  game.phase = 'GRADING';
  broadcastGameState(pin);
  res.json({ success: true });
});

// 12. TEAM LEADER: Submit Answer
app.post('/api/submit-answer', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getStudentGame(clientId);
  if (!context) {
    res.json({ success: false, message: `Siz o'yinga ulanmagansiz!` });
    return;
  }

  const { pin, game, student } = context;
  if (game.phase !== 'ANSWERING') {
    res.json({ success: false, message: 'Hozir javob yuborish vaqti emas yoki javoblar yopiq!' });
    return;
  }

  if (!student.teamId || !student.isLeader) {
    res.json({ success: false, message: `Faqat Guruh Boshlig'i (Sardor) javob yubora oladi!` });
    return;
  }

  const team = game.teams[student.teamId];
  if (!team || team.isEliminated) {
    res.json({ success: false, message: `Sizning jamoangiz o'yindan chiqqan!` });
    return;
  }

  if (team.currentBet === null) {
    res.json({ success: false, message: 'Javob berishdan oldin ball tikish shart edi!' });
    return;
  }

  team.currentAnswer = (req.body?.answer || '').trim();
  team.answerSubmittedAt = Date.now();

  broadcastGameState(pin);
  emitToGame(pin, 'answer_submitted', { teamId: team.id, teamName: team.name });
  emitToGame(pin, 'notification', {
    type: 'success',
    text: `${team.name} javob yubordi!`,
  });
  res.json({ success: true });
});

// 13. TEACHER: Grade/Evaluate Team Answer
app.post('/api/grade-team-answer', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  const team = game.teams[req.body?.teamId];
  if (!team || team.currentBet === null) {
    res.json({ success: false });
    return;
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
    emitToGame(pin, 'notification', {
      type: 'warning',
      text: `${team.name} jamoasining bali 0 ga tushib qoldi va avtomatik ravishda o'yindan chiqdi!`,
    });
  }

  broadcastGameState(pin);
  res.json({ success: true });
});

// 14. TEACHER: Finish Round & Show Round Standings
app.post('/api/finish-round', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
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

  broadcastGameState(pin);
  res.json({ success: true });
});

// 15. TEACHER: Next Question
app.post('/api/next-question', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  if (game.currentQuestionIndex < game.questions.length - 1) {
    const nextIdx = game.currentQuestionIndex + 1;
    game.currentQuestionIndex = nextIdx;
    game.timerSeconds = game.questions[nextIdx]?.timeLimit || 30;
    game.phase = 'BETTING';

    Object.values(game.teams).forEach((team) => {
      team.currentBet = null;
      team.currentAnswer = null;
      team.answerSubmittedAt = null;
      team.lastResult = null;
    });

    broadcastGameState(pin);
  } else {
    game.phase = 'GAME_OVER';
    broadcastGameState(pin);
  }
  res.json({ success: true });
});

// 16. TEACHER: Change Game Phase directly
app.post('/api/set-game-phase', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  game.phase = (req.body?.phase as GamePhase) || game.phase;
  broadcastGameState(pin);
  res.json({ success: true });
});

// 17. TEACHER: Reset/Start New Game (Regenerate PIN)
app.post('/api/reset-game', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const oldPin = teacherPinMap[clientId];

  if (oldPin && games[oldPin]) {
    emitToGame(oldPin, 'kicked_out', 'Parolni xato kiritdingiz');
    emitToGame(oldPin, 'error_message', 'Parolni xato kiritdingiz');
    stopTimer(oldPin);
    delete games[oldPin];
  }

  // Generate NEW PIN Code
  const newPin = generateUniquePin();
  const resetQuestions = loadSavedQuestions();

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

  games[newPin] = newGame;
  teacherPinMap[clientId] = newPin;

  console.log(`Yangi o'yin boshlandi! Yangi PIN: ${newPin}`);
  broadcastGameState(newPin);
  res.json({ success: true, pin: newPin, game: newGame });
});

// 17b. TEACHER: Stop Game but KEEP Teams & Students
app.post('/api/reset-game-keep-teams', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getTeacherGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game } = context;
  stopTimer(pin);
  game.phase = 'TEAMS_SETUP';
  game.currentQuestionIndex = 0;
  game.timerSeconds = game.questions[0]?.timeLimit || 30;

  Object.values(game.teams).forEach((team) => {
    team.currentBet = null;
    team.currentAnswer = null;
    team.answerSubmittedAt = null;
    team.lastResult = null;
    team.isEliminated = false;
  });

  broadcastGameState(pin);
  emitToGame(pin, 'notification', {
    type: 'info',
    text: `O'yin to'xtatildi! Barcha guruhlar va o'quvchilar saqlanib qolindi.`,
  });
  res.json({ success: true });
});

// 18. TEACHER: Update PIN code / password manually
app.post('/api/update-pin', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const cleanPin = (req.body?.newPin || '').toString().trim().toUpperCase();
  if (!cleanPin || cleanPin.length !== 6) {
    res.json({ success: false, message: `O'yin PIN-kodi (paroli) rosa 6 xonali bo'lishi shart!` });
    return;
  }

  const currentPin = teacherPinMap[clientId];
  const game = games[currentPin];
  if (!game || game.teacherClientId !== clientId) {
    res.json({ success: false, message: `Faqat o'qituvchi PIN-kodni o'zgartira oladi!` });
    return;
  }

  if (cleanPin !== currentPin && games[cleanPin]) {
    res.json({ success: false, message: 'Ushbu PIN-kod (parol) boshqa faol o\'yinda ishlatilmoqda!' });
    return;
  }

  if (cleanPin === currentPin) {
    res.json({ success: true, pin: cleanPin, game });
    return;
  }

  // Notify connected students that PIN changed and kick them out
  emitToGame(currentPin, 'kicked_out', 'Parolni xato kiritdingiz');
  emitToGame(currentPin, 'error_message', 'Parolni xato kiritdingiz');

  // Transfer game to new PIN key and clear student list so they re-authenticate
  delete games[currentPin];
  game.pin = cleanPin;
  game.students = {};
  games[cleanPin] = game;

  // Clear student pin mappings for the old game
  Object.keys(studentPinMap).forEach((id) => {
    if (studentPinMap[id] === currentPin) {
      delete studentPinMap[id];
    }
  });

  // Re-map teacher client
  teacherPinMap[clientId] = cleanPin;

  console.log(`PIN-kod (parol) o'zgartirildi va o'quvchilar chiqarildi: ${currentPin} -> ${cleanPin}`);
  broadcastGameState(cleanPin);
  res.json({ success: true, pin: cleanPin, game });
});

// 19. STUDENT: Submit Feedback/Review
app.post('/api/submit-feedback', (req, res) => {
  const clientId = (req.body?.clientId || '').toString();
  const context = getStudentGame(clientId);
  if (!context) {
    res.json({ success: false });
    return;
  }

  const { pin, game, student } = context;
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

  broadcastGameState(pin);
  emitToGame(pin, 'notification', {
    type: 'success',
    text: `${student.name} o'yin haqida fikr bildirdi!`,
  });
  res.json({ success: true });
});

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
