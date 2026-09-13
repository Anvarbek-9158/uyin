import React, { useState, useEffect } from 'react';
import type { Channel } from 'pusher-js';
import { GameSession, Student, Team } from '../types';
import { QuestionCard } from './QuestionCard';
import { Leaderboard } from './Leaderboard';
import { StudentChatLauncher } from './ChatSection';
import { apiPost, setSessionToken } from '../utils/api';
import { useHeartbeat } from '../utils/useHeartbeat';
import { StudentJoinForm } from './StudentJoinForm';
import {
  Crown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  Flame,
  Send,
  ShieldAlert,
  Users,
  MessageSquare,
  ArrowLeft,
  Trophy,
} from 'lucide-react';
import { useLang, getQuestionInLanguage } from '../i18n';

interface StudentViewProps {
  clientId: string;
  channel: Channel | null;
  gameState: GameSession | null;
  initialPin?: string;
  onTeacherClick?: () => void;
  onGameStateChange: (state: GameSession) => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  clientId,
  channel,
  gameState,
  initialPin = '',
  onTeacherClick,
  onGameStateChange,
}) => {
  const { lang, t } = useLang();
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
    apiPost('/api/submit-feedback', {
      clientId,
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

  // Sync state on Pusher channel events
  useEffect(() => {
    if (!channel) return;

    const onError = (msg: string) => {
      setErrorMsg(msg);
      setLoading(false);
    };

    const onKicked = (reason: string) => {
      setJoined(false);
      setStudentId(null);
      setErrorMsg(reason || t('sv_wrong_pin'));
      setLoading(false);
    };

    const onBetPlaced = ({ teamId }: { teamId: string }) => {
      if (myTeam && myTeam.id === teamId) {
        setBetSubmitted(true);
      }
    };

    const onAnswerSubmitted = ({ teamId }: { teamId: string }) => {
      if (myTeam && myTeam.id === teamId) {
        setAnswerSubmitted(true);
      }
    };

    channel.bind('error_message', onError);
    channel.bind('kicked_out', onKicked);
    channel.bind('bet_placed', onBetPlaced);
    channel.bind('answer_submitted', onAnswerSubmitted);

    return () => {
      channel.unbind('error_message', onError);
      channel.unbind('kicked_out', onKicked);
      channel.unbind('bet_placed', onBetPlaced);
      channel.unbind('answer_submitted', onAnswerSubmitted);
    };
  }, [channel, gameState, myTeam]);

  // Student presence heartbeat (QISM G): report in every few seconds. If the
  // server stops receiving these for longer than the student grace period, the
  // student is removed from the game and their team (handing leadership over if
  // they were the leader).
  useHeartbeat(
    async () => {
      if (!studentId || !gameState?.pin) return;
      await apiPost('/api/student-heartbeat', { clientId });
    },
    5000,
    !!studentId && !!gameState?.pin
  );

  // On real unload (close/reload), send one final best-effort heartbeat so the
  // server's staleness clock starts at the close, not at the last scheduled
  // tick. Reloads stay safe: the join-game reconnect path restores the student.
  useEffect(() => {
    if (!studentId || !gameState?.pin) return;
    const onPageHide = () => {
      const blob = new Blob([JSON.stringify({ clientId })], { type: 'application/json' });
      navigator.sendBeacon?.('/api/student-heartbeat', blob);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [clientId, studentId, gameState?.pin]);

  // The server may remove us mid-session (presence expiry or the teacher
  // kicking us). When our record vanishes from the authoritative state, drop
  // back to the login screen with an explanation instead of a broken panel.
  useEffect(() => {
    if (joined && studentId && gameState && !gameState.students[studentId]) {
      setErrorMsg(t('sv_kicked_notice'));
      setJoined(false);
      setStudentId(null);
    }
  }, [joined, studentId, gameState]);

  // Handle Join
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (cleanPin.length !== 6) {
      setErrorMsg(t('sv_pin_6'));
      return;
    }

    if (!nameInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await apiPost<{
      success: boolean;
      studentId?: string;
      message?: string;
      game?: GameSession;
      sessionToken?: string;
    }>('/api/join-game', { clientId, pin: cleanPin, name: nameInput.trim() });

    setLoading(false);
    if (res.success && res.studentId && res.game) {
      if (res.sessionToken) setSessionToken(res.sessionToken);
      setJoined(true);
      setStudentId(res.studentId);
      onGameStateChange(res.game);
    } else {
      setErrorMsg(res.message || t('sv_join_error'));
    }
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
  const handlePlaceBet = async () => {
    if (!isLeader || !myTeam) return;
    if (betAmount < 1 || betAmount > myTeam.score) {
      setErrorMsg(t('sv_bet_range_error').replace('{max}', String(myTeam.score)));
      return;
    }
    setErrorMsg(null);
    const res = await apiPost<{ success: boolean; message?: string }>('/api/place-bet', {
      clientId,
      bet: betAmount,
    });
    if (res.success) {
      setBetSubmitted(true);
    } else {
      setErrorMsg(res.message || t('sv_bet_error'));
    }
  };

  // Handle Answer submit
  const handleAnswerSubmit = async (finalAns?: string) => {
    const val = finalAns !== undefined ? finalAns : answerInput;
    if (!isLeader || !val.trim()) return;

    setErrorMsg(null);
    const res = await apiPost<{ success: boolean; message?: string }>('/api/submit-answer', {
      clientId,
      answer: val.trim(),
    });
    if (res.success) {
      setAnswerSubmitted(true);
    } else {
      setErrorMsg(res.message || t('sv_answer_error'));
    }
  };

  // 1. LOGIN SCREEN (If not joined yet)
  if (!joined || !myStudent) {
    return (
      <StudentJoinForm
        pinInput={pinInput}
        onPinChange={(value) => {
          setErrorMsg(null);
          setPinInput(value);
        }}
        nameInput={nameInput}
        onNameChange={(value) => {
          setErrorMsg(null);
          setNameInput(value);
        }}
        errorMsg={errorMsg}
        loading={loading}
        onSubmit={handleJoin}
        onTeacherClick={onTeacherClick}
      />
    );
  }

  // 2. KUTISH ZALI (Waiting Room - Unassigned student)
  if (!myTeam || !gameState || gameState.phase === 'LOBBY' || gameState.phase === 'TEAMS_SETUP') {
    return (
      <>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 backdrop-blur-md">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
            <Users className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              {t('sv_waiting_room')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t('sv_hello')}{myStudent.name}!
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto font-mono">
              {t('sv_waiting_sub')}
            </p>
          </div>

          {/* Alert if joined mid-game */}
          {gameState && gameState.phase !== 'LOBBY' && gameState.phase !== 'TEAMS_SETUP' && !myTeam && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-center space-y-1 animate-pulse">
              <div className="font-bold uppercase tracking-wider text-amber-300 flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                {t('sv_game_started')}
              </div>
              <p className="text-xs text-amber-200/90 font-mono">
                {t('sv_game_started_sub')}
              </p>
            </div>
          )}

          {/* Current team assignment status */}
          {myTeam ? (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: myTeam.color }} />
              <span className="font-bold text-white text-base">
                {t('sv_joined_team')}{myTeam.name}{t('sv_joined_team_suffix')}
              </span>
              {isLeader && (
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-400 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5" /> {t('sv_team_leader')}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              {t('sv_pending_assign')}
            </div>
          )}
        </div>
        </div>
        {gameState?.pin && (
          <StudentChatLauncher
            clientId={clientId}
            pin={gameState.pin}
            students={gameState.students}
            teams={gameState.teams}
            groupId={myStudent?.teamId || null}
          />
        )}
      </>
    );
  }

  // 3. IN-GAME INTERFACE (Assigned Student / Team Leader)
  const isEliminated = myTeam.isEliminated || myTeam.score <= 0;
  const isGameOver = gameState?.phase === 'GAME_OVER';

  return (
    <>
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
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <Crown className="w-3.5 h-3.5" /> {t('sv_leader_badge')}
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {t('sv_member_label')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('sv_student_label')} <span className="text-white font-semibold">{myStudent.name}</span>
            </p>
          </div>
        </div>

        {/* Team Score */}
        <div className="flex items-center gap-3 bg-slate-950 px-5 py-2.5 rounded-2xl border border-white/10">
          <Award className="w-6 h-6 text-indigo-400" />
          <div>
            <div className="text-xs uppercase font-bold text-slate-500 tracking-widest">
              {t('sv_team_score')}
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
                    {t('sv_game_over')}
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto font-mono mt-1">
                    {t('sv_game_over_sub')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto animate-bounce" />
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                  {t('sv_team_zero')}
                </h2>
                <p className="text-rose-200 text-xs sm:text-sm max-w-md mx-auto font-mono">
                  {t('sv_team_zero_sub')}{myTeam.name}{t('sv_team_zero_sub2')}
                </p>
              </>
            )}
          </div>

          {/* Winners callout (QISM J) */}
          {isGameOver && (gameState?.winners?.length ?? 0) > 0 && (
            <div className="p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500/50 text-center shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                <Crown className="w-7 h-7" />
              </div>
              <h3 className="mt-3 text-lg sm:text-xl font-black uppercase tracking-tight text-amber-200">
                {(gameState.winners ?? []).length > 1 ? t('sv_winners') : t('sv_winner')}
              </h3>
              <p className="mt-1 font-mono font-black text-white text-base sm:text-lg">
                {(gameState.winners ?? [])
                  .map((id) => gameState.teams?.[id]?.name)
                  .filter(Boolean)
                  .join('  🏆  ')}
              </p>
              <p className="mt-2 text-xs text-slate-300 font-mono">
                {t('sv_winners_sub')} 🎉
              </p>
            </div>
          )}

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
                        {t('sv_feedback_title')}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {t('sv_feedback_sub')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExitGame}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer hover:border-indigo-500/50"
                  >
                    <ArrowLeft className="w-4 h-4 text-indigo-400" />
                    {t('sv_back_home')}
                  </button>
                </div>

                {feedbackSubmitted ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <span>{t('sv_feedback_sent')}</span>
                    </div>
                    <button
                      onClick={() => setFeedbackSubmitted(false)}
                      className="text-xs text-emerald-400 underline hover:text-emerald-200 font-mono cursor-pointer"
                    >
                      {t('sv_re_edit')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                        {t('sv_rate_label')}
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
                          🔴 {t('sv_rate_bad')}
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
                          🟡 {t('sv_rate_good')}
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
                          🟢 {t('sv_rate_excellent')}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                        {t('sv_comment_label')}
                      </label>
                      <textarea
                        rows={3}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder={t('sv_comment_placeholder')}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" /> {t('sv_submit_feedback')}
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
            {/* Question Card. During BETTING the question is intentionally
                hidden (the server strips text/options from student state), so
                show a waiting placeholder instead of the card. */}
            {gameState.phase === 'BETTING' ? (
              <div className="bg-slate-900/60 border border-indigo-500/30 rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden text-center backdrop-blur-xl">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 space-y-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-300 pb-3 border-b border-white/10 mx-auto max-w-md">
                    {t('sv_question')}{gameState.currentQuestionIndex + 1} / {gameState.questions.length}
                  </div>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center animate-pulse">
                    <Clock className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    {t('sv_question_waiting')}
                  </h3>
                  <p className="text-sm text-slate-400 font-mono max-w-md mx-auto">
                    {t('sv_question_waiting_sub')}
                  </p>
                </div>
              </div>
            ) : (
              currentQ && (
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
              )
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
                      {t('sv_phase1')}
                    </h3>
                    <span className="text-xs font-mono font-bold text-indigo-300 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                      {t('sv_available')}{myTeam.score} {t('sv_pts')}
                    </span>
                  </div>

                  {isLeader ? (
                    betSubmitted ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        {t('sv_bet_submitted')}{myTeam.currentBet}{t('sv_bet_submitted2')}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-300">
                          {t('sv_bet_prompt')}{myTeam.score})
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
                                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 hover:bg-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider"
                              >
                                {preset === myTeam.score ? t('sv_all_in') : `${preset} ${t('sv_pts')}`}
                              </button>
                            )
                          )}
                        </div>

                        <button
                          onClick={handlePlaceBet}
                          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all"
                        >
                          🔥 {betAmount} {t('sv_confirm_bet')}
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-indigo-400 uppercase tracking-wider">
                        {t('sv_member_only')}
                      </div>
                      <p className="font-mono text-xs">
                        {t('sv_leader_betting')}
                        <span className="font-bold text-white">
                          {myTeam.currentBet !== null ? `${myTeam.currentBet} ${t('sv_pts')}` : t('sv_waiting_bet')}
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
                      {t('sv_phase2')}
                    </h3>
                  </div>

                  {isLeader ? (
                    answerSubmitted ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="break-words leading-snug">
                          {t('sv_answer_submitted')}{myTeam.currentAnswer}{t('sv_answer_submitted2')}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                          {t('sv_answer_go')}
                        </p>

                        {!currentQ?.options || currentQ.options.length === 0 ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={answerInput}
                              onChange={(e) => setAnswerInput(e.target.value)}
                              placeholder={t('sv_answer_placeholder')}
                              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-semibold text-sm focus:outline-none focus:border-indigo-500 w-full"
                            />
                            <button
                              onClick={() => handleAnswerSubmit()}
                              disabled={!answerInput.trim()}
                              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(79,70,229,0.4)] disabled:opacity-50 shrink-0"
                            >
                              <Send className="w-4 h-4" /> {t('sv_submit')}
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic font-mono">
                            {t('sv_pick_option')}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-indigo-400 uppercase tracking-wider">
                        {t('sv_member_only')}
                      </div>
                      <p className="font-mono text-xs">
                        {t('sv_leader_answering')}
                        <span className="font-bold text-white">
                          {myTeam.currentAnswer ? myTeam.currentAnswer : t('sv_thinking')}
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
                    {t('sv_round_grading')}
                  </h4>
                  {gameState.phase === 'ROUND_RESULT' && currentQ?.correctAnswer ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm">
                      <span className="text-emerald-300 font-bold uppercase text-xs tracking-wider">{t('sv_correct_answer')}</span>
                      <span className="font-mono font-black text-white">{getQuestionInLanguage(currentQ, lang).correctAnswer}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 font-mono">
                      {t('sv_teacher_grading')}
                    </p>
                  )}
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
                          ? `🎉 ${t('sv_congrats')}`
                          : `❌ ${t('sv_wrong_answer')}`}
                      </span>
                      <span className="font-mono text-sm">
                        {myTeam.lastResult.isCorrect ? '+' : ''}
                        {myTeam.lastResult.pointsDelta} {t('sv_pts')}
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
                <ArrowLeft className="w-3.5 h-3.5" /> {t('sv_back_home_2')}
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
    {gameState?.pin && (
      <StudentChatLauncher
        clientId={clientId}
        pin={gameState.pin}
        students={gameState.students}
        teams={gameState.teams}
        groupId={myStudent?.teamId || null}
      />
    )}
    </>
  );
};
