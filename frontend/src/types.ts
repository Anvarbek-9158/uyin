export interface Student {
  id: string; // Socket ID or unique student ID
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
  leaderSocketId: string | null;
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
  teacherSocketId: string;
  phase: GamePhase;
  students: Record<string, Student>; // socketId -> Student
  teams: Record<string, Team>;       // teamId -> Team
  questions: Question[];
  currentQuestionIndex: number;
  timerSeconds: number;
  isTimerRunning: boolean;
  maxScoreLimit: number;
  feedbacks?: StudentFeedback[];
  createdAt: number;
}

// Socket Events Payload Types
export interface ServerToClientEvents {
  game_state: (state: GameSession) => void;
  timer_tick: (seconds: number) => void;
  phase_changed: (phase: GamePhase) => void;
  error_message: (message: string) => void;
  kicked_out: (reason: string) => void;
  notification: (data: { type: 'success' | 'info' | 'warning'; text: string }) => void;
  answer_submitted: (data: { teamId: string; teamName: string }) => void;
  bet_placed: (data: { teamId: string; bet: number }) => void;
  feedback_received: (feedback: StudentFeedback) => void;
}

export interface ClientToServerEvents {
  // Teacher actions
  create_game: (callback?: (response: { success: boolean; pin?: string; error?: string }) => void) => void;
  create_team: (data: { name: string; color?: string }) => void;
  delete_team: (data: { teamId: string }) => void;
  assign_student: (data: { studentId: string; teamId: string | null }) => void;
  bulk_assign_students: (data: { studentIds: string[]; teamId: string | null }) => void;
  kick_student: (data: { studentId: string }) => void;
  set_team_leader: (data: { studentId: string; teamId: string }) => void;
  penalize_team: (data: { teamId: string; points: number; reason?: string }) => void;
  set_questions: (questions: Question[]) => void;
  set_game_phase: (phase: GamePhase) => void;
  start_betting_phase: (questionIndex: number) => void;
  start_answering_phase: () => void;
  stop_answering_phase: () => void;
  grade_team_answer: (data: { teamId: string; isCorrect: boolean }) => void;
  finish_round: () => void;
  next_question: () => void;
  reset_game: () => void;
  reset_game_keep_teams: () => void;
  update_pin: (
    data: { newPin: string },
    callback?: (response: { success: boolean; pin?: string; message?: string }) => void
  ) => void;

  // Student actions
  join_game: (
    data: { pin: string; name: string },
    callback?: (response: { success: boolean; studentId?: string; message?: string }) => void
  ) => void;
  place_bet: (data: { bet: number }) => void;
  submit_answer: (data: { answer: string }) => void;
  submit_feedback: (data: { rating: 'Yaxshi' | 'Yomon' | "A'lo"; comment: string }) => void;
}
