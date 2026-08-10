import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { Server, Socket } from 'socket.io';
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
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// CORS headers for API routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
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
  try {
    fs.writeFileSync(QUESTIONS_FILE_PATH, JSON.stringify(questions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving questions database:', err);
  }
}

// Initialize Socket.io with CORS enabled for frontend connections
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-Memory Games Repository
const games: Record<string, GameSession> = {};
const socketPinMap: Record<string, string> = {};
const gameTimers: Record<string, NodeJS.Timeout> = {};

// Helper: Generate unique 6-digit PIN
function generateUniquePin(): string {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games[pin]);
  return pin;
}

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

function broadcastGameState(pin: string) {
  const game = games[pin];
  if (game) {
    io.to(pin).emit('game_state', game);
  }
}

function stopTimer(pin: string) {
  if (gameTimers[pin]) {
    clearInterval(gameTimers[pin]);
    delete gameTimers[pin];
  }
  if (games[pin]) {
    games[pin].isTimerRunning = false;
  }
}

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

// Socket.io Real-Time Event Handlers
io.on('connection', (socket: Socket) => {
  console.log(`рџ”Њ Yangi ulanish: ${socket.id}`);

  // Create game
  socket.on('create_game', (callback) => {
    const pin = generateUniquePin();

    const oldPin = socketPinMap[socket.id];
    if (oldPin && games[oldPin]) {
      io.to(oldPin).emit('kicked_out', 'Parolni xato kiritdingiz');
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

    if (callback) callback({ success: true, pin });
    broadcastGameState(pin);
  });

  // Join game
  socket.on('join_game', ({ pin, name }, callback) => {
    const cleanPin = pin ? pin.trim() : '';
    const cleanName = name ? name.trim() : '';

    const game = games[cleanPin];
    if (!game) {
      if (callback) callback({ success: false, message: 'Bunday PIN-kodli faol o\'yin topilmadi!' });
      return;
    }

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

    if (callback) callback({ success: true, studentId });

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

  // Create team
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
      score: 100,
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

  // Delete team
  socket.on('delete_team', ({ teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (team) {
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

  // Assign student
  socket.on('assign_student', ({ studentId, teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

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

    broadcastGameState(pin);
  });

  // Bulk assign students
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

  // Kick student
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

  // Set team leader
  socket.on('set_team_leader', ({ studentId, teamId }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const team = game.teams[teamId];
    if (!team) return;

    team.memberIds.forEach((id) => {
      if (game.students[id]) {
        game.students[id].isLeader = id === studentId;
      }
    });

    team.leaderSocketId = studentId;
    broadcastGameState(pin);
  });

  // Penalize team
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

  // Set questions
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

  // Start betting phase
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

  // Place bet
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
      socket.emit('error_message', `Tikiladigan ball 1 va jamoaning bali (${team.score}) oralig'ida bo'lsin!`);
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

  // Start answering phase
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

  // Stop answering phase
  socket.on('stop_answering_phase', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    stopTimer(pin);
    game.phase = 'GRADING';
    broadcastGameState(pin);
  });

  // Submit answer
  socket.on('submit_answer', ({ answer }) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.phase !== 'ANSWERING') {
      socket.emit('error_message', 'Hozir javob yuborish vaqti emas!');
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

  // Grade team answer
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

  // Finish round
  socket.on('finish_round', () => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    const currentQ = game.questions[game.currentQuestionIndex];
    if (currentQ) {
      Object.values(game.teams).forEach((team) => {
        if (!team.isEliminated && team.currentBet !== null && team.lastResult === null) {
          const isMatch =
            team.currentAnswer &&
            team.currentAnswer.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();
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

    game.phase = 'ROUND_RESULT';
    broadcastGameState(pin);
  });

  // Next question
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

  // Set game phase
  socket.on('set_game_phase', (phase) => {
    const pin = socketPinMap[socket.id];
    const game = games[pin];
    if (!game || game.teacherSocketId !== socket.id) return;

    game.phase = phase;
    broadcastGameState(pin);
  });

  // Reset game
  socket.on('reset_game', () => {
    const oldPin = socketPinMap[socket.id];
    if (oldPin && games[oldPin]) {
      io.to(oldPin).emit('kicked_out', 'Parolni xato kiritdingiz');
      stopTimer(oldPin);
      delete games[oldPin];
    }

    const newPin = generateUniquePin();
    const newGame: GameSession = {
      pin: newPin,
      teacherSocketId: socket.id,
      phase: 'LOBBY',
      students: {},
      teams: {},
      questions: [...DEFAULT_QUESTIONS],
      currentQuestionIndex: 0,
      timerSeconds: DEFAULT_QUESTIONS[0]?.timeLimit || 30,
      isTimerRunning: false,
      maxScoreLimit: 500,
      feedbacks: [],
      createdAt: Date.now(),
    };

    games[newPin] = newGame;
    socketPinMap[socket.id] = newPin;
    socket.join(newPin);

    broadcastGameState(newPin);
  });

  // Reset game keep teams
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

  // Update PIN
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

    io.to(currentPin).emit('kicked_out', 'Parolni xato kiritdingiz');

    delete games[currentPin];
    game.pin = cleanPin;
    game.students = {};
    games[cleanPin] = game;

    socketPinMap[socket.id] = cleanPin;
    socket.leave(currentPin);
    socket.join(cleanPin);

    if (callback) callback({ success: true, pin: cleanPin });
    broadcastGameState(cleanPin);
  });

  // Submit feedback
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

  // Disconnect
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

httpServer.listen(PORT, () => {
  console.log(`рџљЂ Raqamli Viktorina Backend Serveri ishga tushdi: http://localhost:${PORT}`);
});
