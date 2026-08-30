import React, { useState, useEffect, useRef } from 'react';
import { GameSession, Question, Student, Team } from '../types';
import { Leaderboard } from './Leaderboard';
import { QuestionSelectModal } from './QuestionSelectModal';
import { FeedbackListModal } from './FeedbackListModal';
import { TeacherChatLauncher } from './ChatSection';
import { apiPost } from '../utils/api';
import { useLang, getQuestionInLanguage, translateDiplicity, translateCategory, Language } from '../i18n';
import {
  Users,
  Shield,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Crown,
  Trash2,
  ArrowRight,
  Check,
  RefreshCw,
  VolumeX,
  UserX,
  AlertTriangle,
  LogOut,
  MessageSquare,
  ArrowLeft,
  Trophy,
  Flag,
} from 'lucide-react';

interface TeacherViewProps {
  clientId: string;
  gameState: GameSession | null;
  onResetGame: () => void;
  onCreateGame: () => void;
  onPinUpdated: (game: GameSession) => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({
  clientId,
  gameState,
  onResetGame,
  onCreateGame,
  onPinUpdated,
}) => {
  const { lang, t } = useLang();
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isOptionless, setIsOptionless] = useState(false);
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState('');
  const [newTime, setNewTime] = useState(30);
  const [newDifficulty, setNewDifficulty] = useState<'Oson' | "O'rta" | 'Qiyin'>("O'rta");
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  // Difficulty & Question Selection Modal states
  const [activeDbDifficultyTab, setActiveDbDifficultyTab] = useState<'Barchasi' | 'Oson' | "O'rta" | 'Qiyin'>('Barchasi');
  const [isQuestionSelectModalOpen, setIsQuestionSelectModalOpen] = useState(false);
  const [modalDifficultyTab, setModalDifficultyTab] = useState<'Barchasi' | 'Oson' | "O'rta" | 'Qiyin'>('Barchasi');

  // Deletion confirm states
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Client-driven countdown for the answering phase.
  // The server is stateless on Vercel (no long-running setInterval), so the
  // teacher's browser drives the timer: every second it reports the remaining
  // seconds via /api/timer-tick and the server relays timer_tick to everyone.
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'ANSWERING' || !gameState.isTimerRunning) {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    if (timerIntervalRef.current !== null) return;

    const startedAt = Date.now();
    const totalSeconds = Math.max(0, Math.floor(gameState.timerSeconds || 0));

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      apiPost('/api/timer-tick', { clientId, seconds: remaining }).catch(() => {});
      if (remaining <= 0 && timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    tick();
    timerIntervalRef.current = window.setInterval(tick, 1000);

    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, gameState?.pin, gameState?.phase, gameState?.isTimerRunning]);

  if (!gameState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 animate-bounce">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          {t('nav_teacher_console')}
        </h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          {t('tv_empty_create_sub')}
        </p>
        <button
          onClick={onCreateGame}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-xl shadow-orange-500/20 transition-all scale-105 hover:scale-110"
        >
          🎮 {t('tv_create_game')}
        </button>
      </div>
    );
  }

  const {
    pin,
    phase,
    students,
    teams,
    questions,
    currentQuestionIndex,
    timerSeconds,
  } = gameState;

  const currentQ = questions[currentQuestionIndex];
  const displayQ = currentQ ? getQuestionInLanguage(currentQ, lang) : null;

  // Connected students list
  const studentList = Object.values(students || {}) as Student[];
  const unassignedStudents = studentList.filter((s) => !s.teamId);
  const teamList = Object.values(teams || {}) as Team[];

  // Teacher action handlers
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    apiPost('/api/create-team', { clientId, name: newTeamName.trim() });
    setNewTeamName('');
  };

  // Allow a student (whose name is currently "taken" by another device) to
  // reclaim their name from a new browser. The server records the name and the
  // next join with that name takes over the seat, keeping the team membership.
  const handleReconnectStudent = (studentId: string) => {
    const student = gameState?.students?.[studentId];
    if (!student) return;
    if (
      !window.confirm(
        `"${student.name}" ${t('tv_conn_reason_prefix')}`
      )
    ) {
      return;
    }
    apiPost('/api/reconnect-student', { clientId, studentId });
  };

  // Regenerate the game PIN with one click: every student is kicked out and
  // must re-join with the fresh PIN, while teams and their scores are kept
  // (QISM E).
  const handleRegeneratePin = async () => {
    if (
      !window.confirm(t('tv_pin_regenerate_confirm'))
    ) {
      return;
    }
    const res = await apiPost<{ success: boolean; pin?: string; message?: string; game?: GameSession }>(
      '/api/regenerate-pin',
      { clientId }
    );
    if (res?.success && res.game) {
      onPinUpdated(res.game);
    } else {
      window.alert(res?.message || t('tv_pin_error'));
    }
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newCorrect.trim()) return;

    const opts = isOptionless ? [] : [newOptA, newOptB, newOptC, newOptD].filter((o) => o.trim() !== '');
    const newQ: Question = {
      id: `q_${Date.now()}`,
      text: newQuestionText.trim(),
      options: opts.length > 0 ? opts : undefined,
      correctAnswer: newCorrect.trim(),
      timeLimit: newTime,
      category: isOptionless ? "Variantsiz Ochiq Savol" : "O'qituvchi savoli",
      difficulty: newDifficulty,
    };

    apiPost('/api/set-questions', { clientId, questions: [...questions, newQ] });
    setNewQuestionText('');
    setIsOptionless(false);
    setNewOptA('');
    setNewOptB('');
    setNewOptC('');
    setNewOptD('');
    setNewCorrect('');
    setShowAddQuestion(false);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    const updated = questions.filter((_, idx) => idx !== indexToDelete);
    apiPost('/api/set-questions', { clientId, questions: updated });
    setConfirmDeleteIndex(null);
  };

  const handleDeleteAllQuestions = () => {
    if (questions.length === 0) return;
    apiPost('/api/set-questions', { clientId, questions: [] });
    setConfirmDeleteAll(false);
  };

  const feedbacks = gameState.feedbacks || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. BIG PIN DISPLAY BANNER */}
      <div className="bg-slate-900/90 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 text-center lg:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight uppercase">
              {t('tv_pin_title')}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-mono font-medium tracking-wide">
              {t('tv_pin_sub')}
            </p>
          </div>

          {/* PIN BOX & CUSTOM EDIT BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-4 sm:px-7 sm:py-4 rounded-3xl border-2 border-indigo-500/60 shadow-[0_0_30px_rgba(79,70,229,0.3)] w-full max-w-full sm:w-auto">
            <div className="text-center sm:text-left min-w-0">
              <div className="text-[11px] sm:text-xs uppercase font-extrabold text-slate-400 tracking-widest">
                {t('tv_pin_label')}
              </div>
              <div className="font-mono font-black text-3xl sm:text-4xl md:text-5xl text-indigo-400 tracking-wider sm:tracking-widest leading-none mt-1">
                {pin}
              </div>
            </div>

            <div className="h-10 w-0.5 bg-white/15 hidden sm:block" />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* FEEDBACK BUTTON */}
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 text-[11px] sm:text-xs font-extrabold border border-indigo-500/50 transition-all uppercase tracking-wider relative cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{t('tv_feedback')} ({feedbacks.length})</span>
                {feedbacks.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={handleRegeneratePin}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-200 text-[11px] sm:text-xs font-extrabold border border-emerald-500/50 transition-all uppercase tracking-wider cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                {t('tv_regenerate_pin')}
              </button>

              {phase === 'LOBBY' || phase === 'TEAMS_SETUP' || phase === 'GAME_OVER' ? (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        t('tv_new_game_confirm')
                      )
                    ) {
                      onResetGame();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-[11px] sm:text-xs font-extrabold border border-rose-500/40 transition-all uppercase tracking-wider cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-rose-400 shrink-0" />
                  {t('tv_new_game')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 2. GAME SETUP & TEAM DISTRIBUTION PHASE */}
      {(phase === 'LOBBY' || phase === 'TEAMS_SETUP') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Unassigned Students in Waiting Room */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base uppercase tracking-wider">
                  {t('tv_waiting_room')}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                {unassignedStudents.length} TA
              </span>
            </div>

            {/* Bulk Selection Bar */}
            {unassignedStudents.length > 0 && (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        unassignedStudents.length > 0 &&
                        selectedStudentIds.length === unassignedStudents.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(unassignedStudents.map((s) => s.id));
                        } else {
                          setSelectedStudentIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
                    />
                    <span>{t('tv_select_all_teams')} ({selectedStudentIds.length})</span>
                  </label>

                  {selectedStudentIds.length > 0 && (
                    <button
                      onClick={() => setSelectedStudentIds([])}
                      className="text-[11px] text-slate-400 hover:text-white uppercase font-bold"
                    >
                      {t('tv_clear')}
                    </button>
                  )}
                </div>

                {selectedStudentIds.length > 0 && teamList.length > 0 && (
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <span className="text-[11px] text-indigo-300 font-bold uppercase">{t('tv_assign_group')}</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          apiPost('/api/bulk-assign-students', {
                            clientId,
                            studentIds: selectedStudentIds,
                            teamId: e.target.value,
                          });
                          setSelectedStudentIds([]);
                          e.target.value = '';
                        }
                      }}
                      className="flex-1 px-2 py-1 rounded bg-indigo-600 text-white font-bold text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="">{t('tv_select_team')}</option>
                      {teamList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {unassignedStudents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 font-mono uppercase tracking-widest">
                {t('tv_all_assigned')}
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {unassignedStudents.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-xs ${
                        isChecked
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                          : 'bg-slate-950/60 border-white/5 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds([...selectedStudentIds, st.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter((id) => id !== st.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
                        />
                        <span className="font-semibold text-sm">{st.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReconnectStudent(st.id)}
                          className="p-1 px-2 rounded bg-sky-500/10 hover:bg-sky-500/30 text-sky-300 border border-sky-500/20 text-[11px] font-bold uppercase transition-all flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('tv_reconnect')}
                        </button>
                        <button
                          onClick={() => apiPost('/api/kick-student', { clientId, studentId: st.id })}
                          className="p-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase transition-all flex items-center gap-1"
                        >
                          <UserX className="w-3 h-3" />
                          {t('tv_kick')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Center/Right: Team Creation & Assigning */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-xl uppercase tracking-tight">
                    {t('tv_team_setup_title')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('tv_team_setup_sub')}
                  </p>
                </div>

                {teamList.length > 0 && (
                  <button
                    onClick={() => setIsQuestionSelectModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all scale-105 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    {t('tv_start_quiz')}
                  </button>
                )}
              </div>

              {/* Add Team Form */}
              <form onSubmit={handleCreateTeam} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={t('tv_new_team_placeholder')}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 w-full"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.4)] flex items-center justify-center gap-1.5 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" /> {t('tv_add_team')}
                </button>
              </form>

              {/* Teams Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamList.map((team, idx) => {
                  const accentColors = ['#06b6d4', '#f59e0b', '#f43f5e', '#6366f1', '#10b981'];
                  const teamAccent = team.color || accentColors[idx % accentColors.length];

                  return (
                    <div
                      key={team.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4 relative overflow-hidden group"
                    >
                      <div
                        className="absolute top-0 left-0 w-1.5 h-full"
                        style={{ backgroundColor: teamAccent }}
                      />

                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: teamAccent }}
                          />
                          <h4 className="font-bold text-white text-base">
                            {team.name}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => apiPost('/api/penalize-team', { clientId, teamId: team.id, points: 5, reason: 'shovqin qilgani uchun' })}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase transition-all"
                            title="Shovqin qilgani uchun 5 ball ayirish"
                          >
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            {t('tv_penalize_noise')}
                          </button>

                          <button
                            onClick={() => apiPost('/api/delete-team', { clientId, teamId: team.id })}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                            title="Guruhni o'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Members & Leader Selector */}
                      <div className="space-y-2 pl-2">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {t('tv_members_leader')}
                        </div>
                        {team.memberIds.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">
                            {t('tv_no_members')}
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {team.memberIds.map((mId) => {
                              const st = students[mId];
                              if (!st) return null;
                              const isLeader = st.isLeader;

                              return (
                                <div
                                  key={st.id}
                                  className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                                    isLeader
                                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                                      : 'bg-slate-950/80 border-white/5 text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {isLeader && (
                                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    )}
                                    <span className="font-semibold truncate">{st.name}</span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {!isLeader && (
                                      <button
                                        onClick={() =>
                                          apiPost('/api/set-team-leader', {
                                            clientId,
                                            studentId: st.id,
                                            teamId: team.id,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[11px] font-bold uppercase"
                                      >
                                        {t('tv_make_leader')}
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        apiPost('/api/assign-student', {
                                          clientId,
                                          studentId: st.id,
                                          teamId: null,
                                        })
                                      }
                                      className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                                      title="Guruhdan chiqarib, kutish zaliga qaytarish"
                                    >
                                      <LogOut className="w-3 h-3 text-amber-400" />
                                      <span>{t('tv_to_waiting')}</span>
                                    </button>
                                    <button
                                      onClick={() => apiPost('/api/kick-student', { clientId, studentId: st.id })}
                                      className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors"
                                      title="Tizimdan/o'yindan butunlay o'chirish"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Quick Assign Dropdown */}
                      {unassignedStudents.length > 0 && (
                        <div className="pt-2 border-t border-white/5 pl-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                apiPost('/api/assign-student', {
                                  clientId,
                                  studentId: e.target.value,
                                  teamId: team.id,
                                });
                                e.target.value = '';
                              }
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-slate-300 focus:outline-none"
                          >
                            <option value="">{t('tv_add_student_team')}</option>
                            {unassignedStudents.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACTIVE GAME CONTROLLER PANEL */}
      {phase !== 'LOBBY' && phase !== 'TEAMS_SETUP' && (() => {
        const activeTeams = teamList.filter((t) => !t.isEliminated);
        const teamsWithBets = activeTeams.filter((t) => t.currentBet !== null);
        const allBetPlaced = activeTeams.length > 0 && teamsWithBets.length === activeTeams.length;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Question & Phase Action */}
            <div className="lg:col-span-2 space-y-6">
              {/* Phase Status Banner */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                      {t('tv_round')} {gameState.currentRound ?? 1}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                      {t('tv_question')} {currentQuestionIndex + 1} / {questions.length}
                    </span>
                    <div className="text-xs text-slate-400 font-mono uppercase">
                      {t('tv_phase_label')}{' '}
                      <span className="font-bold text-indigo-400">
                        {phase === 'BETTING' && t('tv_phase1')}
                        {phase === 'ANSWERING' && t('tv_phase2_answering')}
                        {phase === 'GRADING' && t('tv_phase3')}
                        {phase === 'ROUND_RESULT' && `${t('tv_phase4_prefix')}${gameState.currentRound ?? 1}${t('tv_phase4_suffix')}`}
                        {phase === 'GAME_OVER' && t('tv_phase5')}
                      </span>
                    </div>
                  </div>

                  {/* Phase Action Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    {phase === 'BETTING' && (
                      <button
                        onClick={() => apiPost('/api/start-answering-phase', { clientId })}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                          allBetPlaced
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-105'
                            : 'bg-amber-600/80 hover:bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        }`}
                        title={
                          allBetPlaced
                            ? t('tv_start_reveal')
                            : t('tv_reveal_anyway')
                        }
                      >
                        <Play className="w-4 h-4 fill-current" />
                        {allBetPlaced ? t('tv_start_reveal') : t('tv_reveal_anyway')}
                      </button>
                    )}

                    {phase === 'ANSWERING' && (
                      <button
                        onClick={() => apiPost('/api/stop-answering-phase', { clientId })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                      >
                        <Clock className="w-4 h-4" />
                        {t('tv_stop_timer')}
                      </button>
                    )}

                    {phase === 'GRADING' && (
                      <button
                        onClick={() => apiPost('/api/finish-round', { clientId })}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      >
                        <Check className="w-4 h-4" />
                        {t('tv_publish_round')}
                      </button>
                    )}

                    {phase === 'ROUND_RESULT' && (
                      <button
                        onClick={() => setIsQuestionSelectModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.5)] cursor-pointer"
                      >
                        {t('tv_next_question')} <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {/* End the game early and announce the winners (VAZIFA 6/QISM J) */}
                    {phase !== 'GAME_OVER' && phase !== 'LOBBY' && phase !== 'TEAMS_SETUP' && (
                      <button
                        onClick={() => {
                          if (window.confirm(t('tv_end_game_confirm'))) {
                            apiPost('/api/end-game-and-announce-winners', { clientId });
                          }
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        <Flag className="w-3.5 h-3.5 text-rose-400" />
                        {t('tv_end_game')}
                      </button>
                    )}

                    {/* Reset/Stop game but keep teams button */}
                    <button
                      onClick={() => {
                        if (window.confirm(t('tv_stop_keep_teams_confirm'))) {
                          apiPost('/api/reset-game-keep-teams', { clientId });
                        }
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      {t('tv_stop_keep_teams')}
                    </button>
                  </div>
                </div>

                {/* BETTING PHASE STATUS NOTICE BANNER */}
                {phase === 'BETTING' && (
                  <div className="w-full pt-1">
                    {allBetPlaced ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{t('tv_bets_100')}{t('tv_bets_100_sub_prefix')}{teamsWithBets.length}/{activeTeams.length}{t('tv_bets_100_sub_suffix')}</span>
                        </div>
                        <span className="text-[11px] uppercase tracking-wider font-mono bg-emerald-500/30 px-2.5 py-1 rounded text-emerald-200 shrink-0 font-extrabold">
                          {t('tv_bets_100_badge')}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{t('tv_bets_pending')}{t('tv_bets_pending_sub_prefix')}{teamsWithBets.length}/{activeTeams.length}{t('tv_bets_pending_sub_suffix')}</span>
                        </div>
                        <span className="text-[11px] uppercase tracking-wider font-mono bg-amber-500/30 px-2.5 py-1 rounded text-amber-200 shrink-0 font-extrabold">
                          {t('tv_bets_pending_badge')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* LIVE TIMER COUNTDOWN DISPLAY FOR TEACHER */}
                {phase === 'ANSWERING' && (
                  <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all shadow-xl ${
                    timerSeconds <= 5
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse ring-2 ring-rose-500/40'
                      : 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner transition-transform ${
                        timerSeconds <= 5 ? 'bg-rose-600 text-white animate-bounce scale-105' : 'bg-indigo-600 text-white'
                      }`}>
                        <Clock className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          ⏱️ {t('tv_timer_running')}
                        </div>
                        <div className="text-3xl font-black font-mono tracking-tight flex items-baseline gap-2">
                          <span>{timerSeconds}</span>
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t('tv_seconds_left')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right">
                      <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-block ${
                        timerSeconds <= 5 
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                          : 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/50 shadow-[0_0_12px_rgba(79,70,229,0.3)]'
                      }`}>
                        {timerSeconds <= 5 ? `⚠️ ${t('tv_hurry')}` : `⏳ ${t('tv_answer_time')}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* GAME OVER BANNER FOR TEACHER */}
                {phase === 'GAME_OVER' && (
                  <div className="p-5 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-3 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-7 h-7 text-amber-400 shrink-0" />
                        <div>
                          <h4 className="font-black text-white text-lg uppercase tracking-tight">
                            {t('tv_game_over_banner')}
                          </h4>
                          <p className="text-[11px] text-slate-300 font-mono">
                            {t('tv_final_table')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Winners callout (QISM J) */}
                    {(() => {
                      const w = gameState?.winners ?? [];
                      if (w.length === 0) {
                        return (
                          <p className="text-sm font-bold text-slate-300">
                            {t('tv_no_winner')}
                          </p>
                        );
                      }
                      const names = w
                        .map((id) => gameState.teams?.[id]?.name)
                        .filter(Boolean);
                      return (
                        <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-400/50 flex flex-wrap items-center gap-2">
                          <Crown className="w-5 h-5 text-amber-300 shrink-0" />
                          <span className="text-xs font-black uppercase tracking-widest text-amber-300">
                            {names.length > 1 ? t('tv_winners') : t('tv_winner_singular')}
                          </span>
                          <span className="font-mono font-black text-white text-base">
                            {names.join(', ') || '—'}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => apiPost('/api/reset-game-keep-teams', { clientId })}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" /> {t('tv_new_round')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Question Display */}
                {currentQ && (
                  <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-widest text-indigo-400">
                      <span>{translateCategory(displayQ?.category, lang)} • {t('tv_answer_time')}: {displayQ?.timeLimit}s</span>
                      {phase === 'ANSWERING' && (
                        <span className="text-amber-400 font-black animate-pulse">
                          ⏱️ {timerSeconds}s
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-serif text-white">
                      {displayQ?.text}
                    </h3>
                    {/* The correct answer is revealed to the teacher only once
                        grading begins — it stays hidden during BETTING (before
                        students bet) and ANSWERING (while students answer) so
                        the teacher cannot accidentally spoil it. */}
                    {phase === 'GRADING' || phase === 'ROUND_RESULT' || phase === 'GAME_OVER' ? (
                      <div className="text-xs text-emerald-400 font-medium pt-2 border-t border-white/10">
                        {t('tv_correct_answer')}: <span className="font-bold text-white">{displayQ?.correctAnswer}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic pt-2 border-t border-white/10">
                        {t('tv_correct_revealed_later')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* GRADING / INCOMING ANSWERS PANEL */}
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
                <h3 className="font-bold text-white text-lg uppercase tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  {t('tv_teams_bets_answers')}
                </h3>

                <div className="space-y-3">
                  {teamList.map((team, idx) => {
                    if (team.isEliminated) return null;
                    const accentColors = ['#06b6d4', '#f59e0b', '#f43f5e', '#6366f1', '#10b981'];
                    const teamAccent = team.color || accentColors[idx % accentColors.length];

                    return (
                      <div
                        key={team.id}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: teamAccent }} />
                        <div className="pl-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: teamAccent }}
                            />
                            <h4 className="font-bold text-white text-base">
                              {team.name}
                            </h4>
                            <span className="text-xs text-indigo-300 font-mono">
                              ({team.score} {t('lb_points')})
                            </span>

                            <button
                              onClick={() => apiPost('/api/penalize-team', { clientId, teamId: team.id, points: 5, reason: 'shovqin qilgani uchun' })}
                              className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase transition-all"
                            >
                          <VolumeX className="w-3 h-3 text-rose-400" />
                          {t('tv_penalize_noise')}
                        </button>
                          </div>

                          <div className="mt-1 text-xs text-slate-300">
                            {t('tv_bet_placed')}{' '}
                            <span className="font-mono font-bold text-amber-400">
                              {team.currentBet !== null ? `${team.currentBet} ${t('lb_points')}` : t('tv_not_inserted')}
                            </span>
                          </div>

                          <div className="mt-1 text-sm font-semibold text-white">
                            {t('tv_answer')}{' '}
                            {phase === 'ANSWERING' ? (
                              team.currentAnswer
                                ? <span className="text-emerald-300">{t('tv_submitted')}</span>
                                : <span className="text-slate-400">{t('tv_not_answer')}</span>
                            ) : (
                              <span className="text-indigo-200">
                                {team.currentAnswer || t('tv_not_answer2')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Manual Grading Buttons during GRADING phase */}
                        {phase === 'GRADING' && team.currentBet !== null && (
                          <div className="flex items-center gap-2 shrink-0">
                            {team.lastResult !== null ? (
                              <span
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
                                  team.lastResult.isCorrect
                                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                    : 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                                }`}
                              >
                                {team.lastResult.isCorrect ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                                {t('tv_graded')} ({team.lastResult.isCorrect ? '+' : ''}
                                {team.lastResult.pointsDelta})
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    apiPost('/api/grade-team-answer', {
                                      clientId,
                                      teamId: team.id,
                                      isCorrect: true,
                                    })
                                  }
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> {t('tv_correct_graded')} (+{team.currentBet})
                                </button>

                                <button
                                  onClick={() =>
                                    apiPost('/api/grade-team-answer', {
                                      clientId,
                                      teamId: team.id,
                                      isCorrect: false,
                                    })
                                  }
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                                >
                                  <XCircle className="w-4 h-4" /> {t('tv_wrong_graded')} (-{team.currentBet})
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Leaderboard Standings */}
            <div>
              <Leaderboard teams={teams} students={students} currentPhase={phase} />
            </div>
          </div>
        );
      })()}

      {/* 4. QUESTIONS MANAGER SECTION */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white text-lg uppercase tracking-tight">
              {t('tv_questions_bank')}
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              {t('tv_total_questions_prefix')}{questions.length}{t('tv_total_questions_suffix')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {questions.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all"
                title="Barcha savollarni bazadan o'chirish"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                {t('tv_delete_all')}
              </button>
            )}

            <button
              onClick={() => setShowAddQuestion(!showAddQuestion)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('tv_add_question')}
            </button>
          </div>
        </div>

        {/* Add Question Form */}
        {showAddQuestion && (
          <form onSubmit={handleAddQuestion} className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {t('tv_question_text')}
              </label>
              <input
                type="text"
                required
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder={t('tv_question_placeholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Optionless Question Checkbox */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30">
              <input
                type="checkbox"
                id="isOptionless"
                checked={isOptionless}
                onChange={(e) => setIsOptionless(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/20 cursor-pointer"
              />
              <label htmlFor="isOptionless" className="text-xs font-bold text-indigo-200 cursor-pointer select-none">
                {t('tv_optionless')}
              </label>
            </div>

            {/* Variants inputs if NOT optionless */}
            {!isOptionless && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t('tv_variant_a')}
                  value={newOptA}
                  onChange={(e) => setNewOptA(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder={t('tv_variant_b')}
                  value={newOptB}
                  onChange={(e) => setNewOptB(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder={t('tv_variant_c')}
                  value={newOptC}
                  onChange={(e) => setNewOptC(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder={t('tv_variant_d')}
                  value={newOptD}
                  onChange={(e) => setNewOptD(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {t('tv_correct_answer_label')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('tv_correct_placeholder')}
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {t('tv_time_limit')}
                </label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={newTime}
                  onChange={(e) => setNewTime(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-bold text-indigo-300"
                />
              </div>
            </div>

            {/* Difficulty Level Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {t('tv_difficulty')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDifficulty('Oson')}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    newDifficulty === 'Oson'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                      : 'bg-slate-900 border-white/10 text-slate-400'
                  }`}
                >
                  🟢 {translateDiplicity('Oson', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setNewDifficulty("O'rta")}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    newDifficulty === "O'rta"
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                      : 'bg-slate-900 border-white/10 text-slate-400'
                  }`}
                >
                  🟡 {translateDiplicity("O'rta", lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setNewDifficulty('Qiyin')}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    newDifficulty === 'Qiyin'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/60'
                      : 'bg-slate-900 border-white/10 text-slate-400'
                  }`}
                >
                  🔴 {translateDiplicity('Qiyin', lang)}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddQuestion(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs uppercase font-bold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.4)]"
              >
                {t('save')}
              </button>
            </div>
          </form>
        )}

        {/* Database Difficulty Category Tabs */}
        {questions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 pb-1">
            <span className="text-xs font-bold text-slate-400 mr-1 uppercase tracking-wider">{t('tv_filter')}</span>
            <button
              onClick={() => setActiveDbDifficultyTab('Barchasi')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === 'Barchasi'
                  ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {t('qsm_all')} ({questions.length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab('Oson')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === 'Oson'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              🟢 {translateDiplicity('Oson', lang)} ({questions.filter((q) => (q.difficulty || "O'rta") === 'Oson').length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab("O'rta")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === "O'rta"
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              🟡 {translateDiplicity("O'rta", lang)} ({questions.filter((q) => (q.difficulty || "O'rta") === "O'rta").length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab('Qiyin')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === 'Qiyin'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              🔴 {translateDiplicity('Qiyin', lang)} ({questions.filter((q) => (q.difficulty || "O'rta") === 'Qiyin').length})
            </button>
          </div>
        )}

        {/* Questions list preview */}
        {questions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-dashed border-white/10 text-slate-400 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{t('tv_bank_empty')}</p>
            <p className="text-[11px] text-slate-500 font-mono">{t('tv_bank_empty_sub')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
            {questions
              .map((q, idx) => ({ q, originalIndex: idx }))
              .filter(({ q }) => {
                if (activeDbDifficultyTab === 'Barchasi') return true;
                return (q.difficulty || "O'rta") === activeDbDifficultyTab;
              })
              .map(({ q, originalIndex: idx }) => {
                const displayQItem = getQuestionInLanguage(q, lang);
                const isNoOpt = !q.options || q.options.length === 0;
                const diff = q.difficulty || "O'rta";
                const diffBadge =
                  diff === 'Oson'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : diff === 'Qiyin'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                return (
                  <div
                    key={q.id || idx}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                      idx === currentQuestionIndex
                        ? 'bg-indigo-500/20 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold gap-2">
                      <span className="text-indigo-400">
                        {idx < 9 ? `0${idx + 1}` : idx + 1}-{t('tv_question_num')} ({q.timeLimit}{t('tv_time_unit')})
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-bold uppercase ${diffBadge}`}>
                          {diff === 'Oson' && `🟢 ${translateDiplicity('Oson', lang)}`}
                          {diff === "O'rta" && `🟡 ${translateDiplicity("O'rta", lang)}`}
                          {diff === 'Qiyin' && `🔴 ${translateDiplicity('Qiyin', lang)}`}
                        </span>

                        {isNoOpt ? (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                            {t('tv_variantless')}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase">
                            {t('tv_test_label')} ({q.options.length}{t('tv_variant_unit')})
                          </span>
                        )}

                        {/* Delete single question button */}
                        {confirmDeleteIndex === idx ? (
                          <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg">
                            <span className="text-[11px] text-rose-300 font-bold uppercase">{t('tv_delete_confirm')}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuestion(idx);
                              }}
                              className="p-1 rounded bg-rose-600 text-white hover:bg-rose-500"
                              title={t('tv_yes')}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteIndex(null);
                              }}
                              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                              title={t('cancel')}
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteIndex(idx);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="Ushbu savolni o'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="line-clamp-2 pr-1">{displayQItem.text}</p>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Delete All Confirmation Modal */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base uppercase tracking-tight">
                  {t('tv_delete_all_title')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('tv_delete_all_confirm_prefix')}{questions.length}{t('tv_delete_all_confirm_suffix')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteAllQuestions}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)]"
              >
                {t('tv_delete_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Selection Modal prior to Starting Game */}
      <QuestionSelectModal
        isOpen={isQuestionSelectModalOpen}
        onClose={() => setIsQuestionSelectModalOpen(false)}
        questions={questions}
        usedQuestionIds={gameState?.usedQuestionIds}
        onSelectQuestion={(originalIndex) => {
          apiPost('/api/start-betting-phase', { clientId, questionIndex: originalIndex });
        }}
      />

      {/* Student Feedbacks Modal */}
      <FeedbackListModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        feedbacks={feedbacks}
      />

      {/* Floating chat launcher pinned to the top-right corner */}
      <TeacherChatLauncher
        clientId={clientId}
        pin={pin}
        students={students}
        teams={teams}
      />
    </div>
  );
};
