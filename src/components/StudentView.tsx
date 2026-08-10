import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameSession, Student, Team } from '../types';
import { QuestionCard } from './QuestionCard';
import { Leaderboard } from './Leaderboard';
import {
  User,
  Crown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  Flame,
  Send,
  Loader2,
  ShieldAlert,
  Users,
  Shield,
  MessageSquare,
  ArrowLeft,
  Trophy,
} from 'lucide-react';

interface StudentViewProps {
  socket: Socket | null;
  gameState: GameSession | null;
  initialPin?: string;
  onTeacherClick?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  socket,
  gameState,
  initialPin = '',
  onTeacherClick,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [joined, setJoined] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Betting state
  const [betAmount, setBetAmount] = useState<number>(10);
  const [betSubmitted, setBetSubmitted] = useState(false);

  // Answering state
  const [answerInput, setAnswerInput] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // Student Feedback State
  const [feedbackRating, setFeedbackRating] = useState<'Yaxshi' | 'Yomon' | "A'lo">("A'lo");
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    socket.emit('submit_feedback', {
      rating: feedbackRating,
      comment: feedbackComment.trim(),
    });
    setFeedbackSubmitted(true);
  };

  const handleExitGame = () => {
    setJoined(false);
    setStudentId(null);
    setAnswerInput('');
    setAnswerSubmitted(false);
    setBetSubmitted(false);
    setFeedbackSubmitted(false);
    setFeedbackComment('');
  };

  // PIN input starts clean/blank by default; only set if URL explicitly contains pin parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pinParam = urlParams.get('pin');
    if (pinParam && pinParam.trim().length === 6) {
      setPinInput(pinParam.trim().toUpperCase());
    }
  }, []);

  // Find current student & team from gameState
  const myStudent = gameState && studentId ? gameState.students[studentId] : null;
  const myTeam = myStudent && myStudent.teamId && gameState ? gameState.teams[myStudent.teamId] : null;
  const isLeader = myStudent?.isLeader || false;

  const currentQ = gameState?.questions[gameState.currentQuestionIndex];

  // Sync state on socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('error_message', (msg: string) => {
      setErrorMsg(msg);
      setLoading(false);
    });

    socket.on('kicked_out', (reason: string) => {
      setJoined(false);
      setStudentId(null);
      setErrorMsg(reason || 'Parolni xato kiritdingiz!');
      setLoading(false);
    });

    socket.on('bet_placed', ({ teamId }) => {
      if (myTeam && myTeam.id === teamId) {
        setBetSubmitted(true);
      }
    });

    socket.on('answer_submitted', ({ teamId }) => {
      if (myTeam && myTeam.id === teamId) {
        setAnswerSubmitted(true);
      }
    });

    return () => {
      socket.off('error_message');
      socket.off('kicked_out');
      socket.off('bet_placed');
      socket.off('answer_submitted');
    };
  }, [socket, gameState, myTeam]);

  // Handle Join
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (cleanPin.length !== 6) {
      setErrorMsg("O'yin PIN-kodi rosa 6 xonali bo'lishi shart! (Kam ham, ko'p ham bo'lishi mumkin emas)");
      return;
    }

    if (!nameInput.trim() || !socket) return;

    setLoading(true);
    setErrorMsg(null);

    socket.emit(
      'join_game',
      { pin: cleanPin, name: nameInput.trim() },
      (res: { success: boolean; studentId?: string; message?: string }) => {
        setLoading(false);
        if (res.success && res.studentId) {
          setJoined(true);
          setStudentId(res.studentId);
        } else {
          setErrorMsg(res.message || 'O\'yinga ulanishda xatolik yuz berdi!');
        }
      }
    );
  };

  // Reset local bet/answer state when phase or question changes
  useEffect(() => {
    if (gameState?.phase === 'BETTING') {
      setBetSubmitted(myTeam?.currentBet !== null && myTeam?.currentBet !== undefined);
      setAnswerSubmitted(false);
      setAnswerInput('');
    } else if (gameState?.phase === 'ANSWERING') {
      setAnswerSubmitted(myTeam?.currentAnswer !== null && myTeam?.currentAnswer !== undefined);
    }
  }, [gameState?.phase, gameState?.currentQuestionIndex]);

  // Handle Bet submit
  const handlePlaceBet = () => {
    if (!socket || !isLeader || !myTeam) return;
    if (betAmount < 1 || betAmount > myTeam.score) {
      setErrorMsg(`Tikiladigan ball 1 va ${myTeam.score} oralig'ida bo'lishi lozim!`);
      return;
    }
    setErrorMsg(null);
    socket.emit('place_bet', { bet: betAmount });
    setBetSubmitted(true);
  };

  // Handle Answer submit
  const handleAnswerSubmit = (finalAns?: string) => {
    const val = finalAns !== undefined ? finalAns : answerInput;
    if (!socket || !isLeader || !val.trim()) return;

    setErrorMsg(null);
    socket.emit('submit_answer', { answer: val.trim() });
    setAnswerSubmitted(true);
  };

  // 1. LOGIN SCREEN (If not joined yet)
  if (!joined || !myStudent) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
          
          {/* Top Bar inside Card */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5 relative z-20">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-white/5 text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>O'quvchi Tizimi</span>
            </div>

            {onTeacherClick && (
              <button
                type="button"
                onClick={onTeacherClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:border-indigo-400 shadow-sm"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>O'qituvchi bo'lib kirish</span>
              </button>
            )}
          </div>

          {/* Title & Icon Header */}
          <div className="text-center space-y-3 relative z-10 pt-1">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(79,70,229,0.4)] font-black text-2xl border border-indigo-400/30">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
                O'quvchilar Kirishi
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                O'qituvchi ko'rsatgan PIN-kod va ismingizni kiriting
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-1.5">
                1) O'yin PIN-Kodi (6 xonali)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                required
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setErrorMsg(null);
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                placeholder="Masalan: 849201"
                className="w-full text-center tracking-widest font-mono font-black text-2xl sm:text-3xl px-4 py-4 rounded-2xl bg-slate-950 border-2 border-indigo-500/50 text-indigo-400 focus:outline-none focus:border-indigo-400 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-1.5">
                2) Ismingiz (Student Name)
              </label>
              <input
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                value={nameInput}
                onChange={(e) => {
                  setErrorMsg(null);
                  setNameInput(e.target.value);
                }}
                placeholder="Ism va familiyangiz..."
                className="w-full px-5 py-4 rounded-2xl bg-slate-950 border-2 border-white/10 text-white font-bold text-base sm:text-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pinInput.trim().length !== 6 || !nameInput.trim()}
              className="w-full py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm sm:text-base uppercase tracking-widest shadow-[0_0_25px_rgba(79,70,229,0.5)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> Ulaninmoqda...
                </>
              ) : (
                'O\'yinga Kirish (Join)'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. KUTISH ZALI (Waiting Room - Unassigned student)
  if (!myTeam || !gameState || gameState.phase === 'LOBBY' || gameState.phase === 'TEAMS_SETUP') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 backdrop-blur-md">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
            <Users className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              Kutish Zali
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Salom, {myStudent.name}!
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto font-mono">
              O'qituvchi sizni guruhga taqsimlashini kuting...
            </p>
          </div>

          {/* Alert if joined mid-game */}
          {gameState && gameState.phase !== 'LOBBY' && gameState.phase !== 'TEAMS_SETUP' && !myTeam && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-center space-y-1 animate-pulse">
              <div className="font-bold uppercase tracking-wider text-amber-300 flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                O'yin Allaqachon Boshlangan!
              </div>
              <p className="text-[11px] text-amber-200/90 font-mono">
                Siz hozir kutish zalidasiz. O'qituvchi o'yin vaqtida ham sizni guruhga biriktira oladi. Kuting...
              </p>
            </div>
          )}

          {/* Current team assignment status */}
          {myTeam ? (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: myTeam.color }} />
              <span className="font-bold text-white text-base">
                Siz "{myTeam.name}" guruhiga qo'shildingiz!
              </span>
              {isLeader && (
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5" /> Guruh Boshlig'i
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              O'qituvchi ekranida ismingiz ko'rinmoqda. Taqsimot kutilmoqda.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. IN-GAME INTERFACE (Assigned Student / Team Leader)
  const isEliminated = myTeam.isEliminated || myTeam.score <= 0;
  const isGameOver = gameState?.phase === 'GAME_OVER';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Team Header Banner */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span
            className="w-5 h-5 rounded-full shrink-0 shadow-lg"
            style={{ backgroundColor: myTeam.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                {myTeam.name}
              </h2>
              {isLeader ? (
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5" /> Siz Guruh Boshlig'isiz (Sardor)
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                  Oddiy A'zo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              O'quvchi: <span className="text-white font-semibold">{myStudent.name}</span>
            </p>
          </div>
        </div>

        {/* Team Score */}
        <div className="flex items-center gap-3 bg-slate-950 px-5 py-2.5 rounded-2xl border border-white/10">
          <Award className="w-6 h-6 text-indigo-400" />
          <div>
            <div className="text-[11px] uppercase font-bold text-slate-500 tracking-widest">
              Jamoa Bali
            </div>
            <div className="font-mono font-black text-2xl text-indigo-300 leading-none mt-0.5">
              {myTeam.score}
            </div>
          </div>
        </div>
      </div>

      {/* GAME OVER OR ELIMINATED SCREEN */}
      {isGameOver || isEliminated ? (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl backdrop-blur-md relative overflow-hidden">
            {isGameOver ? (
              <>
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(245,158,11,0.4)] animate-bounce">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                    O'yin Yakunlandi!
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto font-mono mt-1">
                    Ushbu viktorina o'yini o'z nihoyasiga yetdi. Barcha guruhlar natijalari bilan tanishing!
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto animate-bounce" />
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                  Jamoangiz Bali 0 ga tushib qoldi!
                </h2>
                <p className="text-rose-200 text-xs sm:text-sm max-w-md mx-auto font-mono">
                  Afsuski, {myTeam.name} jamoasi ushbu viktorina o'yinidan avtomatik ravishda chetlatildi.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Feedback Form */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-xl relative">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                        O'yin va Dars Haqida Fikringiz
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Taassurotlaringiz va takliflaringizni o'qituvchiga yuboring
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExitGame}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer hover:border-indigo-500/50"
                  >
                    <ArrowLeft className="w-4 h-4 text-indigo-400" />
                    Bosh Sahifaga Qaytish
                  </button>
                </div>

                {feedbackSubmitted ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <span>Rahmat! Fikringiz va bahongiz o'qituvchiga muvaffaqiyatli yetkazildi.</span>
                    </div>
                    <button
                      onClick={() => setFeedbackSubmitted(false)}
                      className="text-xs text-emerald-400 underline hover:text-emerald-200 font-mono cursor-pointer"
                    >
                      Qayta tahrirlash
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        O'yin va topshiriqlarni baholang:
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setFeedbackRating('Yomon')}
                          className={`py-3 px-3 sm:px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            feedbackRating === 'Yomon'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                              : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          🔴 Yomon
                        </button>

                        <button
                          type="button"
                          onClick={() => setFeedbackRating('Yaxshi')}
                          className={`py-3 px-3 sm:px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            feedbackRating === 'Yaxshi'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                              : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          🟡 Yaxshi
                        </button>

                        <button
                          type="button"
                          onClick={() => setFeedbackRating("A'lo")}
                          className={`py-3 px-3 sm:px-4 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            feedbackRating === "A'lo"
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                              : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          🟢 A'lo
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                        O'z fikringiz / Taklif va mulohazalaringiz:
                      </label>
                      <textarea
                        rows={3}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Dars va viktorina juda zo'r bo'ldi / Qaysi savollar yoqqanligi haqida..."
                        className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" /> Fikrimni Yuborish
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right: Leaderboard Standings */}
            <div>
              <Leaderboard
                teams={gameState.teams}
                students={gameState.students}
                currentPhase={gameState.phase}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Question Card */}
            {currentQ && (
              <QuestionCard
                question={currentQ}
                questionIndex={gameState.currentQuestionIndex}
                totalQuestions={gameState.questions.length}
                timerSeconds={gameState.timerSeconds}
                isAnsweringUnlocked={gameState.phase === 'ANSWERING'}
                selectedOption={answerInput}
                onSelectOption={(opt) => {
                  setAnswerInput(opt);
                  if (isLeader) {
                    handleAnswerSubmit(opt);
                  }
                }}
                isLeader={isLeader}
              />
            )}

            {/* ERROR NOTIFICATION */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ROLE CONTROLS / ACTION BOX */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
              {/* PHASE 1: BETTING PHASE */}
              {gameState.phase === 'BETTING' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h3 className="font-bold text-white text-base uppercase tracking-wider flex items-center gap-2">
                      <Flame className="w-5 h-5 text-indigo-400" />
                      1-Bosqich: Ball Tikish (Betting)
                    </h3>
                    <span className="text-xs font-mono font-bold text-indigo-300 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                      Mavjud: {myTeam.score} ball
                    </span>
                  </div>

                  {isLeader ? (
                    betSubmitted ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Siz guruh nomidan {myTeam.currentBet} ball tikdingiz! O'qituvchi 'Boshlash' tugmasini bosishini kuting...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-300">
                          Jamoangiz uchun ushbu savolga qancha ball tikasiz? (1 va {myTeam.score} oralig'ida)
                        </p>

                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={1}
                            max={myTeam.score}
                            value={betAmount}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            className="flex-1 accent-indigo-500"
                          />
                          <span className="font-mono font-black text-2xl text-indigo-400 w-16 text-right">
                            {betAmount}
                          </span>
                        </div>

                        {/* Bet Presets */}
                        <div className="flex flex-wrap items-center gap-2">
                          {[10, 20, 50, Math.floor(myTeam.score / 2), myTeam.score].map(
                            (preset, idx) => (
                              <button
                                key={idx}
                                onClick={() => setBetAmount(Math.min(myTeam.score, preset))}
                                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 hover:bg-slate-800 text-[11px] font-bold text-slate-300 uppercase tracking-wider"
                              >
                                {preset === myTeam.score ? 'ALL IN!' : `${preset} ball`}
                              </button>
                            )
                          )}
                        </div>

                        <button
                          onClick={handlePlaceBet}
                          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all"
                        >
                          🔥 {betAmount} Ball Tikishni Tasdiqlash
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-indigo-400 uppercase tracking-wider">
                        Siz oddiy guruh a'zosisiz!
                      </div>
                      <p className="font-mono text-[11px]">
                        Guruh sardori ball tikmoqda. Tikilgan ball:{' '}
                        <span className="font-bold text-white">
                          {myTeam.currentBet !== null ? `${myTeam.currentBet} ball` : 'Kutilmoqda...'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 2: ANSWERING PHASE */}
              {gameState.phase === 'ANSWERING' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h3 className="font-bold text-white text-base uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-400" />
                      2-Bosqich: Javob Yozish (Taymer Ishlamoqda)
                    </h3>
                  </div>

                  {isLeader ? (
                    answerSubmitted ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="break-words leading-snug">
                          Javob muvaffaqiyatli yuborildi: "{myTeam.currentAnswer}". Vaqt tugashini kuting!
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                          O'qituvchi 'Boshlash' tugmasini bosdi! Javobingizni quyida kiritib yuboring:
                        </p>

                        {!currentQ?.options || currentQ.options.length === 0 ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={answerInput}
                              onChange={(e) => setAnswerInput(e.target.value)}
                              placeholder="Javobingizni yozing..."
                              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-semibold text-sm focus:outline-none focus:border-indigo-500 w-full"
                            />
                            <button
                              onClick={() => handleAnswerSubmit()}
                              disabled={!answerInput.trim()}
                              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(79,70,229,0.4)] disabled:opacity-50 shrink-0"
                            >
                              <Send className="w-4 h-4" /> Yuborish
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic font-mono">
                            Yuqoridagi javob variantlaridan birini bosing.
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-indigo-400 uppercase tracking-wider">
                        Siz oddiy guruh a'zosisiz!
                      </div>
                      <p className="font-mono text-[11px]">
                        Guruh sardori javob bermoqda. Yuborilgan javob:{' '}
                        <span className="font-bold text-white">
                          {myTeam.currentAnswer ? myTeam.currentAnswer : 'O\'ylamoqda...'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 3 & 4: GRADING & ROUND RESULTS */}
              {(gameState.phase === 'GRADING' || gameState.phase === 'ROUND_RESULT') && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                  <h4 className="font-bold text-indigo-400 text-xs uppercase tracking-wider">
                    Raund Baholash Bosqichi
                  </h4>
                  <p className="text-xs text-slate-300 font-mono">
                    O'qituvchi javoblarni va ballarni tekshirmoqda...
                  </p>
                  {myTeam.lastResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between uppercase tracking-wider ${
                        myTeam.lastResult.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span>
                        {myTeam.lastResult.isCorrect
                          ? '🎉 Tabriklaymiz! Javobingiz to\'g\'ri!'
                          : '❌ Javobingiz xato bo\'ldi!'}
                      </span>
                      <span className="font-mono text-sm">
                        {myTeam.lastResult.isCorrect ? '+' : ''}
                        {myTeam.lastResult.pointsDelta} ball
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Exit Button during live game */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExitGame}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Bosh Sahifaga Qaytish
              </button>
            </div>
          </div>

          {/* Right Column: Leaderboard Standings */}
          <div>
            <Leaderboard
              teams={gameState.teams}
              students={gameState.students}
              currentPhase={gameState.phase}
            />
          </div>
        </div>
      )}
    </div>
  );
};
