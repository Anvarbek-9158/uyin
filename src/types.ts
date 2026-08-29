export interface Student {
  id: string; // Client ID (UUID from localStorage)
  name: string;
  pin: string;
  teamId: string | null;
  isLeader: boolean;
  connected: boolean;
  // Client presence heartbeat. Set whenever the student's browser reports in
  // (join, heartbeat). When it goes stale for longer than the student grace
  // period the student is treated as disconnected and removed from the game
  // (and, if they were a leader, leadership is handed to the next member).
  lastSeenAt?: number | null;
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
  // --- Presence (QISM D/F/G) ---
  // Server-side authoritative presence. The teacher's browser (and each
  // student's browser) reports in periodically; if the value goes stale for
  // longer than the grace period the game is auto-ended (teacher) or the
  // student is removed (student). Optional so pre-existing Redis games and test
  // fixtures (which predate the feature) keep working — a missing value is
  // treated as "unknown, never expire".
  teacherLastSeenAt?: number | null;
  // --- Rounds (QISM H) ---
  // A "raund" is a fixed-size chunk of consecutive questions. Scores stay
  // cumulative across rounds. currentRound is 1-based; questionsPlayedInRound
  // counts the questions started inside the current round.
  currentRound?: number;
  questionsPerRound?: number;
  questionsPlayedInRound?: number;
  // --- Non-repeating questions (QISM I) ---
  // Ids of all questions already used across the whole game. With unlimited
  // rounds the teacher can keep playing freely but a question is never picked
  // twice; when every question has been used the game is declared over.
  usedQuestionIds?: string[];
  // --- Winners (QISM J) ---
  // Team ids that won the game once it is over (top-scoring, non-eliminated
  // team; ties are all champions). Empty when the game ended with no champion
  // (e.g. every team bankrupt). Populated by the 'end-game-and-announce-winners'
  // endpoint and shown to both teacher and students.
  winners?: string[];
  winnersAnnouncedAt?: number;
  // --- Identity re-claim (teacher-assisted reconnect) ---
  // A student who switches to a new device/browser has a fresh clientId, so
  // reusing their old name would normally be rejected as a hijack. The teacher
  // can explicitly allow a name to be reclaimed by pressing "Qayta ulash" on
  // that student; the lowercased name is recorded here and the next join with
  // that name takes over the seat (team/membership preserved). A successful
  // reclaim removes the name from the list.
  reconnectWhitelist?: string[];
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
