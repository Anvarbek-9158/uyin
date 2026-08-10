import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  GameSession,
  Question,
  Student,
  Team,
  ClientToServerEvents,
  ServerToClientEvents,
} from './src/types.js';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.js';

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(express.json());

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
  try {
    fs.writeFileSync(QUESTIONS_FILE_PATH, JSON.stringify(questions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving questions database:', err);
  }
}

// Initialize Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-Memory Games Repository
// Key: 6-digit PIN code -> GameSession
const games: Record<string, GameSession> = {};
// Map socket ID -> PIN code
const socketPinMap: Record<string, string> = {};
// Map socket ID -> Timer Interval
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

// Helper: Broadcast game state to room
function broadcastGameState(pin: string) {
  const game = games[pin];
  if (game) {
    io.to(pin).emit('game_state', game);
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
    io.to(pin).emit('timer_tick', games[pin].timerSeconds);

    if (games[pin].timerSeconds <= 0) {
      stopTimer(pin);
      games[pin].phase = 'GRADING';
      broadcastGameState(pin);
      io.to(pin).emit('notification', {
        type: 'warning',
        text: 'Vaqt tugadi! Javoblar qabul qilish to\'xtatildi.',
      });
    }
  }, 1000);
}

// REST API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeGames: Object.keys(games).length });
});

// Socket.io Real-Time Connection Handling
io.on('connection', (socket: Socket) => {
  console.log(`рџ”Њ Yangi ulanish: ${socket.id}`);

  // 1. TEACHER: Create new game session (or reset)
  socket.on('create_game', (callback) => {
    // Generate fresh unique 6-digit PIN
    const pin = generateUniquePin();

    // Clean up old game if socket was host elsewhere
    const oldPin = socketPinMap[socket.id];
    if (oldPin && games[oldPin]) {
      io.to(oldPin).emit('kicked_out', 'Parolni xato kiritdingiz');
      io.to(oldPin).emit('error_message', 'Parolni xato kiritdingiz');
      stopTimer(oldPin);
      delete games[oldPin];
      socket.leave(oldPin);
    }

    const initialQuestions = loadSavedQuestions();
    const newGame: GameSession = {
      pin,
      teacherSocketId: socket.id,
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
    socketPinMap[socket.id] = pin;
    socket.join(pin);

    console.log(`рџЋ® Yangi o'yin seansi yaratildi! PIN: ${pin}`);

    if (callback) {
      callback({ success: true, pin });
    }
    broadcastGameState(pin);
  });

  // 2. STUDENT: Join existing game via PIN & Name
  socket.on('join_game', ({ pin, name }, callback) => {
    const cleanPin = pin ? pin.trim() : '';
    const cleanName = name ? name.trim() : '';

    const game = games[cleanPin];
    if (!game) {
      if (callback) {
        callback({
          success: false,
          message: 'Bunday PIN-kodli faol o\'yin topilmadi! Iltimos, o\'qituvchidan PIN-kodni qayta surishtiring.',
        });
      }
      return;
    }

    // Check name collision in room
    const existingStudent = Object.values(game.students).find(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase()
    );

    let studentId = socket.id;

    if (existingStudent) {
      // Reconnect student: remove the stale entry under the old socket id
      // so the same student is NOT duplicated in the room.
      const oldId = existingStudent.id;
      if (oldId && oldId !== socket.id) {
        delete game.students[oldId];
      }
      existingStudent.id = socket.id;
      existingStudent.connected = true;
      game.students[socket.id] = existingStudent;
    } else {
      // New student register
      const newStudent: Student = {
        id: socket.id,
        name: cleanName,
        pin: cleanPin,
        teamId: null,
        isLeader: false,
        connected: true,
      };
      game.students[socket.id] = newStudent;
    }

    socketPinMap[socket.id] = cleanPin;
    socket.join(cleanPin);

    if (callback) {
      callback({ success: true, studentId });
    }

    if (game.phase !== 'LOBBY' && game.phase !== 'TEAMS_SETUP') {
      io.to(cleanPin).emit('notification', {
        type: 'warning',
        text: `рџ”” Yangi o'quvchi (${cleanName}) ulandi! O'yin boshlanganligi sababli u kutish zalida.`,
      });
    } else {
      io.to(cleanPin).emit('notification', {
        type: 'info',
        text: `${cleanName} o'yinga qo'shildi!`,
      });
    }

    broadcastGameState(cleanPin);
  });

  // 3. TEACHER: Create a Team
  socket.on('create_team', ({ name, color }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const teamCount = Object.keys(game.teams).length;
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const teamColor = color || TEAM_COLORS[teamCount % TEAM_COLORS.length];

    const newTeam: Team = {
      id: teamId,
      name: name || `Guruh ${teamCount + 1}`,
      color: teamColor,
      score: 100, // Initial score 100 points
      leaderSocketId: null,
      memberIds: [],
      currentBet: null,
      currentAnswer: null,
      answerSubmittedAt: null,
      isEliminated: false,
      lastResult: null,
    };

    game.teams[teamId] = newTeam;
    broadcastGameState(pin);
  });

  // 4. TEACHER: Delete a Team
  socket.on('delete_team', ({ teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (team) {
      // Remove team assignment from students
      team.memberIds.forEach((studentId) => {
        if (game.students[studentId]) {
          game.students[studentId].teamId = null;
          game.students[studentId].isLeader = false;
        }
      });
      delete game.teams[teamId];
      broadcastGameState(pin);
    }
  });

  // 5. TEACHER: Assign Student to Team
  socket.on('assign_student', ({ studentId, teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const student = game.students[studentId];
    if (!student) return;

    // Remove from previous team if any
    if (student.teamId && game.teams[student.teamId]) {
      const prevTeam = game.teams[student.teamId];
      prevTeam.memberIds = prevTeam.memberIds.filter((id) => id !== studentId);
      if (prevTeam.leaderSocketId === studentId) {
        prevTeam.leaderSocketId = prevTeam.memberIds[0] || null;
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
      if (!targetTeam.leaderSocketId) {
        targetTeam.leaderSocketId = studentId;
        student.isLeader = true;
      }
    }

    broadcastGameState(pin);
  });

  // 5b. TEACHER: Bulk Assign Students to Team
  socket.on('bulk_assign_students', ({ studentIds, teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id || !Array.isArray(studentIds)) return;

    studentIds.forEach((studentId) => {
      const student = game.students[studentId];
      if (!student) return;

      if (student.teamId && game.teams[student.teamId]) {
        const prevTeam = game.teams[student.teamId];
        prevTeam.memberIds = prevTeam.memberIds.filter((id) => id !== studentId);
        if (prevTeam.leaderSocketId === studentId) {
          prevTeam.leaderSocketId = prevTeam.memberIds[0] || null;
        }
      }

      student.teamId = teamId;
      student.isLeader = false;

      if (teamId && game.teams[teamId]) {
        const targetTeam = game.teams[teamId];
        if (!targetTeam.memberIds.includes(studentId)) {
          targetTeam.memberIds.push(studentId);
        }
        if (!targetTeam.leaderSocketId) {
          targetTeam.leaderSocketId = studentId;
          student.isLeader = true;
        }
      }
    });

    broadcastGameState(pin);
  });

  // 5c. TEACHER: Kick / Remove student from game
  socket.on('kick_student', ({ studentId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const student = game.students[studentId];
    if (!student) return;

    if (student.teamId && game.teams[student.teamId]) {
      const team = game.teams[student.teamId];
      team.memberIds = team.memberIds.filter((id) => id !== studentId);
      if (team.leaderSocketId === studentId) {
        team.leaderSocketId = team.memberIds[0] || null;
      }
    }

    delete game.students[studentId];
    broadcastGameState(pin);
  });

  // 6. TEACHER: Set explicit Team Leader
  socket.on('set_team_leader', ({ studentId, teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (!team) return;

    // Unset current leader in team
    team.memberIds.forEach((id) => {
      if (game.students[id]) {
        game.students[id].isLeader = id === studentId;
      }
    });

    team.leaderSocketId = studentId;
    broadcastGameState(pin);
  });

  // 6b. TEACHER: Penalize Team (-5 points for noise/disruption)
  socket.on('penalize_team', ({ teamId, points, reason }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (!team) return;

    const penalty = points || 5;
    team.score = Math.max(0, team.score - penalty);
    if (team.score <= 0) {
      team.isEliminated = true;
    }

    broadcastGameState(pin);
    io.to(pin).emit('notification', {
      type: 'warning',
      text: `рџ”Љ ${team.name} jamoasidan ${reason || 'shovqin qilgani uchun'} -${penalty} ball olindi! Joriy ball: ${team.score}`,
    });
  });

  // 7. TEACHER: Set Question Database
  socket.on('set_questions', (questions) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    game.questions = questions;
    game.currentQuestionIndex = 0;
    game.timerSeconds = questions[0]?.timeLimit || 30;
    saveQuestionsToFile(questions);
    broadcastGameState(pin);
  });

  // 8. TEACHER: Start Betting Phase for a Question
  socket.on('start_betting_phase', (questionIndex) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    stopTimer(pin);
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
    io.to(pin).emit('notification', {
      type: 'info',
      text: 'Savol ekranga chiqdi! Jamoalar ball tikishni boshlang.',
    });
  });

  // 9. TEAM LEADER: Place Bet
  socket.on('place_bet', ({ bet }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.phase !== 'BETTING') return;

    const student = game.students[socket.id];
    if (!student || !student.teamId || !student.isLeader) {
      socket.emit('error_message', 'Faqat Guruh Boshlig\'i (Sardor) ball tika oladi!');
      return;
    }

    const team = game.teams[student.teamId];
    if (!team || team.isEliminated) {
      socket.emit('error_message', 'Sizning jamoangiz o\'yindan chiqqan!');
      return;
    }

    const numericBet = Math.floor(Number(bet));
    if (isNaN(numericBet) || numericBet < 1 || numericBet > team.score) {
      socket.emit(
        'error_message',
        `Tikiladigan ball 1 va jamoaning mavjud bali (${team.score}) oralig'ida bo'lishi shart!`
      );
      return;
    }

    team.currentBet = numericBet;
    broadcastGameState(pin);

    io.to(pin).emit('bet_placed', { teamId: team.id, bet: numericBet });
    io.to(pin).emit('notification', {
      type: 'success',
      text: `${team.name} jamoasi ${numericBet} ball tikdi!`,
    });
  });

  // 10. TEACHER: Click "Boshlash" to enable answering & timer
  socket.on('start_answering_phase', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const activeTeams = Object.values(game.teams).filter((t) => !t.isEliminated);
    const unbetTeams = activeTeams.filter((t) => t.currentBet === null);

    if (activeTeams.length > 0 && unbetTeams.length > 0) {
      socket.emit('error_message', `Hali barcha guruhlar ball tikmadi! (${activeTeams.length - unbetTeams.length}/${activeTeams.length} guruh tikdi)`);
      return;
    }

    const currentQ = game.questions[game.currentQuestionIndex];
    game.timerSeconds = currentQ?.timeLimit || 30;
    game.phase = 'ANSWERING';

    broadcastGameState(pin);
    startQuestionTimer(pin);

    io.to(pin).emit('notification', {
      type: 'info',
      text: 'O\'qituvchi taymerni boshladi! Guruh sardorlari javob kiritishi mumkin!',
    });
  });

  // 11. TEACHER: Manually Stop Answering Phase
  socket.on('stop_answering_phase', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    stopTimer(pin);
    game.phase = 'GRADING';
    broadcastGameState(pin);
  });

  // 12. TEAM LEADER: Submit Answer
  socket.on('submit_answer', ({ answer }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.phase !== 'ANSWERING') {
      socket.emit('error_message', 'Hozir javob yuborish vaqti emas yoki javoblar yopiq!');
      return;
    }

    const student = game.students[socket.id];
    if (!student || !student.teamId || !student.isLeader) {
      socket.emit('error_message', 'Faqat Guruh Boshlig\'i (Sardor) javob yubora oladi!');
      return;
    }

    const team = game.teams[student.teamId];
    if (!team || team.isEliminated) return;

    if (team.currentBet === null) {
      socket.emit('error_message', 'Javob berishdan oldin ball tikish shart edi!');
      return;
    }

    team.currentAnswer = answer.trim();
    team.answerSubmittedAt = Date.now();

    broadcastGameState(pin);
    io.to(pin).emit('answer_submitted', { teamId: team.id, teamName: team.name });
    io.to(pin).emit('notification', {
      type: 'success',
      text: `${team.name} javob yubordi!`,
    });
  });

  // 13. TEACHER: Grade/Evaluate Team Answer
  socket.on('grade_team_answer', ({ teamId, isCorrect }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (!team || team.currentBet === null) return;

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
      io.to(pin).emit('notification', {
        type: 'warning',
        text: `вљ пёЏ ${team.name} jamoasining bali 0 ga tushib qoldi va avtomatik ravishda o'yindan chiqdi!`,
      });
    }

    broadcastGameState(pin);
  });

  // 14. TEACHER: Finish Round & Show Round Standings
  socket.on('finish_round', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

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
  });

  // 15. TEACHER: Next Question
  socket.on('next_question', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

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
  });

  // 16. TEACHER: Change Game Phase directly
  socket.on('set_game_phase', (phase) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    game.phase = phase;
    broadcastGameState(pin);
  });

  // 17. TEACHER: Reset/Start New Game (Regenerate PIN)
  socket.on('reset_game', () => {
    const oldPin = socketPinMap[socket.id];
    if (oldPin && games[oldPin]) {
      io.to(oldPin).emit('kicked_out', 'Parolni xato kiritdingiz');
      io.to(oldPin).emit('error_message', 'Parolni xato kiritdingiz');
      stopTimer(oldPin);
      delete games[oldPin];
      socket.leave(oldPin);
    }

    // Generate NEW PIN Code
    const newPin = generateUniquePin();
    const resetQuestions = loadSavedQuestions();

    const newGame: GameSession = {
      pin: newPin,
      teacherSocketId: socket.id,
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
    socketPinMap[socket.id] = newPin;
    socket.join(newPin);

    console.log(`рџ”„ Yangi o'yin boshlandi! Yangi PIN: ${newPin}`);
    broadcastGameState(newPin);
  });

  // 17b. TEACHER: Stop Game but KEEP Teams & Students
  socket.on('reset_game_keep_teams', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

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
    io.to(pin).emit('notification', {
      type: 'info',
      text: "O'yin to'xtatildi! Barcha guruhlar va o'quvchilar saqlanib qolindi.",
    });
  });

  // 18. TEACHER: Update PIN code / password manually
  socket.on('update_pin', ({ newPin }, callback) => {
    const cleanPin = newPin ? newPin.trim().toUpperCase() : '';
    if (!cleanPin || cleanPin.length !== 6) {
      if (callback) callback({ success: false, message: "O'yin PIN-kodi (paroli) rosa 6 xonali bo'lishi shart!" });
      return;
    }

    const currentPin = socketPinMap[socket.id];
    const game = games[currentPin];
    if (!game || game.teacherSocketId !== socket.id) {
      if (callback) callback({ success: false, message: 'Faqat o\'qituvchi PIN-kodni o\'zgartira oladi!' });
      return;
    }

    if (cleanPin !== currentPin && games[cleanPin]) {
      if (callback) callback({ success: false, message: 'Ushbu PIN-kod (parol) boshqa faol o\'yinda ishlatilmoqda!' });
      return;
    }

    if (cleanPin === currentPin) {
      if (callback) callback({ success: true, pin: cleanPin });
      return;
    }

    // Notify connected students that PIN changed and kick them out
    io.to(currentPin).emit('kicked_out', 'Parolni xato kiritdingiz');
    io.to(currentPin).emit('error_message', 'Parolni xato kiritdingiz');

    // Transfer game to new PIN key and clear student list so they re-authenticate
    delete games[currentPin];
    game.pin = cleanPin;
    game.students = {};
    games[cleanPin] = game;

    // Re-map teacher socket
    socketPinMap[socket.id] = cleanPin;
    socket.leave(currentPin);
    socket.join(cleanPin);

    console.log(`рџ”‘ PIN-kod (parol) o'zgartirildi va o'quvchilar chiqarildi: ${currentPin} -> ${cleanPin}`);
    if (callback) callback({ success: true, pin: cleanPin });
    broadcastGameState(cleanPin);
  });

  // 19. STUDENT: Submit Feedback/Review
  socket.on('submit_feedback', ({ rating, comment }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game) return;

    const student = game.students[socket.id];
    if (!student) return;

    const team = student.teamId ? game.teams[student.teamId] : null;

    if (!game.feedbacks) {
      game.feedbacks = [];
    }

    const newFeedback = {
      id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      studentId: socket.id,
      studentName: student.name,
      teamName: team ? team.name : 'Guruhsiz',
      rating: (rating || "A'lo") as 'Yaxshi' | 'Yomon' | "A'lo",
      comment: (comment || '').trim(),
      createdAt: Date.now(),
    };

    const existingIdx = game.feedbacks.findIndex((f) => f.studentId === socket.id);
    if (existingIdx >= 0) {
      game.feedbacks[existingIdx] = newFeedback;
    } else {
      game.feedbacks.push(newFeedback);
    }

    broadcastGameState(pin);
    io.to(pin).emit('notification', {
      type: 'success',
      text: `рџ’¬ ${student.name} o'yin haqida fikr bildirdi!`,
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`вќЊ Ulanish uzildi: ${socket.id}`);
    const pin = socketPinMap[socket.id];
    if (pin) {
      const game = games[pin];

      // If the TEACHER disconnects, the game session has no host anymore:
      // stop the timer, notify all students and remove the session.
      if (game && game.teacherSocketId === socket.id) {
        stopTimer(pin);
        io.to(pin).emit('kicked_out', "O'qituvchi tizimdan chiqdi. O'yin yopildi!");
        io.to(pin).emit('error_message', "O'qituvchi tizimdan chiqdi. O'yin yopildi!");
        delete games[pin];
        delete socketPinMap[socket.id];
        socket.leave(pin);
        return;
      }

      // Student disconnect
      if (game && game.students[socket.id]) {
        game.students[socket.id].connected = false;
        broadcastGameState(pin);
      }
      delete socketPinMap[socket.id];
    }
  });
});

// Serve frontend in dev or prod
async function main() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`рџљЂ Raqamli Viktorina serveri ishga tushdi: http://0.0.0.0:${PORT}`);
  });
}

main();
