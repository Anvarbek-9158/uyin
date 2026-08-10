import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  GameSession,
  Question,
  Student,
  Team,
  GamePhase,
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

// Helper function for dynamic fallback question generation when AI API key is invalid or unavailable
function generateTopicQuestionsFallback(topic: string, userPrompt: string, count: number = 10, difficulty: 'Oson' | "O'rta" | 'Qiyin' = "O'rta"): Question[] {
  const cleanTopic = (topic || 'Umumiy Bilimlar').trim();
  const lower = cleanTopic.toLowerCase();
  
  const questionPool: { text: string; options: string[]; correctAnswer: string; explanation: string; difficulty?: 'Oson' | "O'rta" | 'Qiyin' }[] = [];

  if (lower.includes('informatika') || lower.includes('dastur') || lower.includes('kompyuter') || lower.includes('raqamli')) {
    questionPool.push(
      { text: "Kompyuterning asosiy mantiqiy hisoblash va boshqaruv qurilmasi qaysi?", options: ["Protsessor (CPU)", "Operativ xotira (RAM)", "Qattiq disk (HDD)", "Videokarta (GPU)"], correctAnswer: "Protsessor (CPU)", explanation: "CPU barcha buyruq va hisob-kitoblarni bajaruvchi asosiy mantiqiy markazdir.", difficulty: "Oson" },
      { text: "1 Gigabayt (GB) necha Megabayt (MB) ga teng?", options: ["1024 MB", "1000 MB", "512 MB", "2048 MB"], correctAnswer: "1024 MB", explanation: "Ikkilik sanoq tizimida 1 GB = 2^10 MB = 1024 MB.", difficulty: "Oson" },
      { text: "Quyidagilardan qaysi biri dasturlash tili hisoblanadi?", options: ["Python", "HTML", "CSS", "HTTP"], correctAnswer: "Python", explanation: "Python ob'ektga yo'naltirilgan yuqori darajali dasturlash tilidir.", difficulty: "O'rta" },
      { text: "Internetda veb-sahifalarni ko'rish uchun mo'ljallangan dastur nima deyiladi?", options: ["Brauzer", "Protsessor", "Operatsion tizim", "Antivirus"], correctAnswer: "Brauzer", explanation: "Chrome, Firefox, Safari kabi dasturlar brauzerlar turiga kiradi.", difficulty: "Oson" },
      { text: "Axborotning eng kichik o'lchov birligi nima?", options: ["Bit", "Bayt", "Kilobayt", "Megabayt"], correctAnswer: "Bit", explanation: "Bit 0 yoki 1 qiymatlarini oluvchi eng kichik birlikdir.", difficulty: "Oson" },
      { text: "Ma'lumotlar bazasini boshqarish uchun eng mashhur til qaysi?", options: ["SQL", "HTML", "JSON", "XML"], correctAnswer: "SQL", explanation: "SQL relational ma'lumotlar bazalari bilan ishlash standart tilidir.", difficulty: "O'rta" },
      { text: "Taqsimlangan ma'lumotlar bazalarida CAP teoremasiga ko'ra nechta kafolatga erishiladi?", options: ["Faqat 2 tasiga", "Barcha 3 tasiga", "Faqat 1 tasiga", "Birontasiga emas"], correctAnswer: "Faqat 2 tasiga", explanation: "CAP teoremasiga ko'ra ko'pi bilan 2 ta kafolat bir vaqtda ta'minlanadi.", difficulty: "Qiyin" },
      { text: "Algoritmlashda shartli o'tish operatori qaysi so'z bilan ifodalanadi?", options: ["IF / ELSE", "FOR / WHILE", "PRINT", "FUNCTION"], correctAnswer: "IF / ELSE", explanation: "IF/ELSE shart qanoatlantirilishiga ko'ra mos tarmoqqa yo'naltiradi.", difficulty: "O'rta" }
    );
  } else if (lower.includes('matematika') || lower.includes('hisob') || lower.includes('algebra') || lower.includes('geometriya')) {
    questionPool.push(
      { text: "To'g'ri burchakli uchburchakda gipotenuza kvadratiga bag'ishlangan teorema muallifi kim?", options: ["Pifagor", "Evklid", "Arximed", "Nyuton"], correctAnswer: "Pifagor", explanation: "Pifagor teoremasi: a² + b² = c².", difficulty: "O'rta" },
      { text: "Doiraning yuzi formulasi qanday ifodalanadi?", options: ["S = πr²", "S = 2πr", "S = πd", "S = 4πr²"], correctAnswer: "S = πr²", explanation: "r - doira radiusi bo'lganda yuzi πr² bo'ladi.", difficulty: "O'rta" },
      { text: "Eng kichik tub son nechaga teng?", options: ["2", "1", "3", "0"], correctAnswer: "2", explanation: "2 yagona juft tub sondir va eng kichigidir.", difficulty: "Oson" },
      { text: "√144 amali qanday qiymat beradi?", options: ["12", "14", "16", "10"], correctAnswer: "12", explanation: "12 * 12 = 144.", difficulty: "Oson" },
      { text: "Kvadrat tenglama diskriminanti D < 0 bo'lsa, haqiqiy ildizlar soni nechta?", options: ["0 ta", "1 ta", "2 ta", "Cheksiz"], correctAnswer: "0 ta", explanation: "Diskriminant manfiy bo'lganda haqiqiy ildizlar bo'lmaydi.", difficulty: "Qiyin" },
      { text: "Sinus 90 darajada nechaga teng?", options: ["1", "0", "0.5", "-1"], correctAnswer: "1", explanation: "Birlik aylanada sin(90°) = 1.", difficulty: "O'rta" }
    );
  } else {
    // General topic dynamic generator
    questionPool.push(
      { text: `"${cleanTopic}" sohasining eng muhim va asosiy tushunchasi nimadan iborat?`, options: ["Mantiq va tahlil", "Xotira va tezlik", "Standart qoidalar", "Tizimli yondashuv"], correctAnswer: "Mantiq va tahlil", explanation: `${cleanTopic} fanida mantiqiy tahlil eng asosiy o'rinni egallaydi.`, difficulty: "Oson" },
      { text: `"${cleanTopic}" mavzusida bilimlarni muvaffaqiyatli baholashning samarali usuli qaysi?`, options: ["Amaliy test va viktorina", "Faqat nazariya yodlash", "Izohsiz topshiriqlar", "Natijani tekshirmaslik"], correctAnswer: "Amaliy test va viktorina", explanation: "Interaktiv viktorinalar bilimni mustahkamlash uchun optimaldir.", difficulty: "O'rta" },
      { text: `"${cleanTopic}" bo'yicha berilgan murakkab masalalarni yechishda birinchi navbatda nima qilinadi?`, options: ["Shartni sinchiklab tahlil qilish", "Shoshilib javob belgilash", "Faqat birinchi variantni tanlash", "Savolni o'tkazib yuborish"], correctAnswer: "Shartni sinchiklab tahlil qilish", explanation: "To'g'ri tahlil to'g'ri yechimning yarmi hisoblanadi.", difficulty: "Qiyin" },
      { text: `Raqamli o'qitish tizimida "${cleanTopic}" fanining asosiy afzalligi nima?`, options: ["Interaktiv va qiziqarli o'rganish", "Qiyin formulasiz yondashuv", "Vaqtni cheklab qo'yish", "Natijasiz baholash"], correctAnswer: "Interaktiv va qiziqarli o'rganish", explanation: "Interaktiv texnologiyalar o'quvchilar motivatsiyasini oshiradi.", difficulty: "Oson" }
    );
  }

  // Filter pool matching requested difficulty if possible, otherwise use full pool
  const matchingPool = questionPool.filter((q) => q.difficulty === difficulty);
  const poolToUse = matchingPool.length >= 3 ? matchingPool : questionPool;

  const shuffled = [...poolToUse].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map((q, idx) => ({
    id: `q_fb_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    timeLimit: difficulty === 'Qiyin' ? 45 : difficulty === 'Oson' ? 25 : 30,
    category: cleanTopic,
    difficulty: q.difficulty || difficulty,
    explanation: q.explanation,
  }));
}

// REST API: Gemini AI Question Generator Endpoint (Server-Side Key)
app.post('/api/ai-generate-questions', async (req, res) => {
  const { topic = 'Umumiy bilimlar', userPrompt = '', count = 10, difficulty = "O'rta", imageBase64 } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const reqDifficulty: 'Oson' | "O'rta" | 'Qiyin' = ['Oson', "O'rta", 'Qiyin'].includes(difficulty) ? difficulty : "O'rta";

  // Try calling Gemini API if API key exists
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Prepare Image Part if provided
      let imagePart: any = null;
      if (imageBase64 && typeof imageBase64 === 'string') {
        const matches = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          imagePart = {
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          };
        } else {
          imagePart = {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          };
        }
      }

      const systemPromptText = `Siz maktab o'quvchilari va talabalar uchun professional interaktiv viktorina o'yini tuzuvchi mutaxassissiz.
Mavzu: "${topic}".
Qiyinlik darajasi: "${reqDifficulty}" (Oson, O'rta yoki Qiyin).
${userPrompt ? `O'qituvchi maxsus ko'rsatmasi (prompt): "${userPrompt}".` : ''}
${imagePart ? "Yuklangan rasm (darslik, topshiriq yoki masalalar) mazmunidan foydalanib savollar yarating." : ''}

Iltimos, ushbu manba/mavzu/rasm asosida mos ravishda "${reqDifficulty}" qiyinlik darajasidagi ${count || 10} ta qiziqarli, aniq va bilimni sinovchi 4 variantli test savollarini tuzing.
Javobni FAQAT QUYIDAGI JSON FORMATIDA QAYTARING (hech qanday qo'shimcha matnsiz):
[
  {
    "id": "q1",
    "text": "Savol matni",
    "options": ["A variant", "B variant", "C variant", "D variant"],
    "correctAnswer": "A variant",
    "timeLimit": 30,
    "category": "${topic || 'Umumiy'}",
    "difficulty": "${reqDifficulty}",
    "explanation": "Qisqa va tushunarli izoh"
  }
]
Eslatma:
1. Har bir savol uchun "correctAnswer" matni "options" massividagi 4 ta variantdan biri bilan aynan bir xil bo'lishi shart!
2. "options" massivida rosa 4 ta variant bo'lsin.
3. "difficulty" ushbu qiymatlardan biri bo'lsin: "${reqDifficulty}".
4. "timeLimit" 15 va 60 orasida bo'lsin (soniya).`;

      let contents: any;
      if (imagePart) {
        contents = {
          parts: [imagePart, { text: systemPromptText }],
        };
      } else {
        contents = systemPromptText;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
      });

      const responseText = response.text || '';
      const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        let parsedQuestions: any[] = JSON.parse(jsonMatch[0]);
        const generatedQuestions: Question[] = parsedQuestions.map((q, idx) => {
          const opts = Array.isArray(q.options) && q.options.length >= 2 
            ? q.options 
            : ['Variant A', 'Variant B', 'Variant C', 'Variant D'];
          
          let correct = q.correctAnswer || opts[0];
          if (!opts.includes(correct)) {
            correct = opts[0];
          }

          return {
            id: `ai_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            text: q.text || `Savol ${idx + 1}`,
            options: opts,
            correctAnswer: correct,
            timeLimit: Number(q.timeLimit) || (reqDifficulty === 'Qiyin' ? 45 : reqDifficulty === 'Oson' ? 20 : 30),
            category: q.category || topic || 'Umumiy',
            difficulty: reqDifficulty,
            explanation: q.explanation || '',
          };
        });

        return res.json({ success: true, questions: generatedQuestions });
      }
    } catch (err: any) {
      console.warn('Gemini API call warning/fallback triggered:', err?.message || err);
      // Fall through to smart topic-based fallback below!
    }
  }

  // Graceful fallback when API key is missing or invalid
  const fallbackQuestions = generateTopicQuestionsFallback(topic, userPrompt, count || 10, reqDifficulty);
  return res.json({ success: true, questions: fallbackQuestions, isFallback: true });
});

// REST API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeGames: Object.keys(games).length });
});

// Socket.io Real-Time Connection Handling
io.on('connection', (socket: Socket) => {
  console.log(`🔌 Yangi ulanish: ${socket.id}`);

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

    console.log(`🎮 Yangi o'yin seansi yaratildi! PIN: ${pin}`);

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
        text: `🔔 Yangi o'quvchi (${cleanName}) ulandi! O'yin boshlanganligi sababli u kutish zalida.`,
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
      text: `🔊 ${team.name} jamoasidan ${reason || 'shovqin qilgani uchun'} -${penalty} ball olindi! Joriy ball: ${team.score}`,
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
        text: `⚠️ ${team.name} jamoasining bali 0 ga tushib qoldi va avtomatik ravishda o'yindan chiqdi!`,
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

    console.log(`🔄 Yangi o'yin boshlandi! Yangi PIN: ${newPin}`);
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

    console.log(`🔑 PIN-kod (parol) o'zgartirildi va o'quvchilar chiqarildi: ${currentPin} -> ${cleanPin}`);
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
      text: `💬 ${student.name} o'yin haqida fikr bildirdi!`,
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`❌ Ulanish uzildi: ${socket.id}`);
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
    console.log(`🚀 Raqamli Viktorina serveri ishga tushdi: http://0.0.0.0:${PORT}`);
  });
}

main();
