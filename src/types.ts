export interface Student {
  id: string; // Client ID (UUID from localStorage)
  name: string;
  pin: string;
  teamId: string | null;
  isLeader: boolean;
  connected: boolean;
}

export interface TeamResult {
  isCorrect: boolean;
  pointsDelta: number;
  bet: number;
  answer: string;
  correctAnswer: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  leaderClientId: string | null;
  memberIds: string[];
  currentBet: number | null;
  currentAnswer: string | null;
  answerSubmittedAt: number | null;
  isEliminated: boolean;
  lastResult: TeamResult | null;
}

export interface Question {
  id: string;
  text: string;
  options?: string[]; // Optional multiple choice options
  correctAnswer: string;
  timeLimit: number; // in seconds
  category?: string;
  explanation?: string;
  difficulty?: 'Oson' | "O'rta" | 'Qiyin';
}

export type GamePhase =
  | 'LOBBY'            // Students joining, PIN active
  | 'TEAMS_SETUP'     // Teacher organizing students into teams & leaders
  | 'BETTING'         // Question shown, leaders betting points
  | 'QUESTION_READING'// Question being read out, answer locked
  | 'ANSWERING'       // Teacher unlocked "Boshlash", leaders typing answers & timer ticking
  | 'GRADING'         // Timer ended or teacher stopped, evaluating answers
  | 'ROUND_RESULT'    // Points updated, showing round standings
  | 'GAME_OVER';      // Game completed or champion declared

export interface StudentFeedback {
  id: string;
  studentId: string;
  studentName: string;
  teamName: string;
  rating: 'Yaxshi' | 'Yomon' | "A'lo";
  comment: string;
  createdAt: number;
}

export interface GameSession {
  pin: string;
  teacherClientId: string;
  phase: GamePhase;
  students: Record<string, Student>; // clientId -> Student
  teams: Record<string, Team>;       // teamId -> Team
  questions: Question[];
  currentQuestionIndex: number;
  timerSeconds: number;
  isTimerRunning: boolean;
  maxScoreLimit: number;
  feedbacks?: StudentFeedback[];
  createdAt: number;
}

// Chat message. Every message belongs to a chat room:
//   - "private" rooms are 1:1 student <-> teacher (roomId = the student's id),
//   - "group" rooms are shared by all members of one team/group
//     (roomId = the team id; groupId === roomId).
// The teacher can read/write every room of the game; a student may only access
// their own private room and the room of their own group.
export interface ChatMessage {
  id: string;
  senderId: string; // student clientId or teacher clientId
  senderName: string;
  role: 'teacher' | 'student';
  text: string;
  createdAt: number;
  roomType: 'private' | 'group';
  groupId?: string | null;
}

// Pusher Channels Event Payload Types
export interface GameChannelEvents {
  game_state: GameSession;
  timer_tick: number;
  notification: { type: 'success' | 'info' | 'warning'; text: string };
  answer_submitted: { teamId: string; teamName: string };
  bet_placed: { teamId: string; bet: number };
  kicked_out: string;
  error_message: string;
}

// REST API response payloads (subset shared across endpoints)
export interface ApiResponse {
  success: boolean;
  message?: string;
  pin?: string;
  studentId?: string;
  game?: GameSession;
}
