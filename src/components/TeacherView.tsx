import React, { useState } from 'react';
import { GameSession, Question, Student, Team } from '../types';
import { useTeacherTimer } from '../hooks/useTeacherTimer';
import { TeacherPinBanner } from './TeacherPinBanner';
import { TeamSetupSection } from './TeamSetupSection';
import { ActiveGamePanel } from './ActiveGamePanel';
import { QuestionSelectModal } from './QuestionSelectModal';
import { FeedbackListModal } from './FeedbackListModal';
import { TeacherChatLauncher } from './ChatSection';
import { apiPost } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import { useLang, getQuestionInLanguage, translateDiplicity, Language } from '../i18n';
import {
  Shield,
  Plus,
  XCircle,
  Trash2,
  Check,
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
  const { user } = useAuth();
  const isPro = user?.plan === 'pro';
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

  // Unified in-app confirm/alert dialog (replaces window.confirm/window.alert).
  type ConfirmState =
    | { kind: 'reconnect'; student: Student }
    | { kind: 'regenerate-pin' }
    | { kind: 'reset-game' }
    | { kind: 'end-game' }
    | { kind: 'stop-keep-teams' }
    | { kind: 'delete-all' }
    | { kind: 'alert'; message: string };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // Inline per-question delete confirmation index
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Students link copy state
  const [studentsLinkCopied, setStudentsLinkCopied] = useState(false);

  useTeacherTimer(clientId, gameState);

  if (!gameState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 animate-bounce">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          {t('nav_teacher_console')}
        </h2>
        {isPro && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-black tracking-widest text-slate-950 shadow-lg shadow-amber-500/30 mb-4">
            {t('tv_pro_badge')}
          </span>
        )}
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
    setConfirmState({ kind: 'reconnect', student });
  };

  // Regenerate the game PIN with one click: every student is kicked out and
  // must re-join with the fresh PIN, while teams and their scores are kept
  // (QISM E).
  const handleRegeneratePin = () => {
    setConfirmState({ kind: 'regenerate-pin' });
  };

  const doRegeneratePin = async () => {
    const res = await apiPost<{ success: boolean; pin?: string; message?: string; game?: GameSession }>(
      '/api/regenerate-pin',
      { clientId }
    );
    if (res?.success && res.game) {
      onPinUpdated(res.game);
    } else {
      setConfirmState({ kind: 'alert', message: res?.message || t('tv_pin_error') });
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
    setConfirmState(null);
  };

  const feedbacks = gameState.feedbacks || [];

  // Map the current confirm state to the shared Modal dialog.
  const renderConfirmModal = () => {
    if (!confirmState) return null;

    const close = () => setConfirmState(null);

    switch (confirmState.kind) {
      case 'reconnect':
        return (
          <Modal
            open
            variant="danger"
            title={t('confirm_action')}
            message={`"${confirmState.student.name}" ${t('tv_conn_reason_prefix')}`}
            confirmLabel={t('confirm_action')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={() => {
              apiPost('/api/reconnect-student', { clientId, studentId: confirmState.student.id });
              close();
            }}
          />
        );
      case 'regenerate-pin':
        return (
          <Modal
            open
            variant="danger"
            title={t('confirm_action')}
            message={t('tv_pin_regenerate_confirm')}
            confirmLabel={t('confirm_action')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={() => {
              doRegeneratePin();
            }}
          />
        );
      case 'reset-game':
        return (
          <Modal
            open
            variant="danger"
            title={t('confirm_action')}
            message={t('tv_new_game_confirm')}
            confirmLabel={t('confirm_action')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={() => {
              onResetGame();
              close();
            }}
          />
        );
      case 'end-game':
        return (
          <Modal
            open
            variant="danger"
            title={t('confirm_action')}
            message={t('tv_end_game_confirm')}
            confirmLabel={t('confirm_action')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={() => {
              apiPost('/api/end-game-and-announce-winners', { clientId });
              close();
            }}
          />
        );
      case 'stop-keep-teams':
        return (
          <Modal
            open
            variant="danger"
            title={t('confirm_action')}
            message={t('tv_stop_keep_teams_confirm')}
            confirmLabel={t('confirm_action')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={() => {
              apiPost('/api/reset-game-keep-teams', { clientId });
              close();
            }}
          />
        );
      case 'delete-all':
        return (
          <Modal
            open
            variant="danger"
            title={t('tv_delete_all_title')}
            message={`${t('tv_delete_all_confirm_prefix')}${questions.length}${t('tv_delete_all_confirm_suffix')}`}
            confirmLabel={t('tv_delete_confirm_btn')}
            cancelLabel={t('cancel_action')}
            onCancel={close}
            onConfirm={handleDeleteAllQuestions}
          />
        );
      case 'alert':
        return (
          <Modal
            open
            title={t('tv_pin_error')}
            message={confirmState.message}
            confirmLabel={t('close')}
            onCancel={close}
            onConfirm={close}
          />
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. BIG PIN DISPLAY BANNER */}
      <TeacherPinBanner
        pin={pin}
        feedbackCount={feedbacks.length}
        studentsLinkCopied={studentsLinkCopied}
        showResetGame={phase === 'LOBBY' || phase === 'TEAMS_SETUP' || phase === 'GAME_OVER'}
        onCopyStudentsLink={() => {
          navigator.clipboard.writeText(`${window.location.origin}/#/play`);
          setStudentsLinkCopied(true);
          setTimeout(() => setStudentsLinkCopied(false), 2000);
        }}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        onRegeneratePin={handleRegeneratePin}
        onResetGame={() => setConfirmState({ kind: 'reset-game' })}
      />

      {/* 2. GAME SETUP & TEAM DISTRIBUTION PHASE */}
      {(phase === 'LOBBY' || phase === 'TEAMS_SETUP') && (
        <TeamSetupSection
          teamList={teamList}
          students={students}
          unassignedStudents={unassignedStudents}
          selectedStudentIds={selectedStudentIds}
          newTeamName={newTeamName}
          onSelectStudents={setSelectedStudentIds}
          onNewTeamNameChange={setNewTeamName}
          onCreateTeam={handleCreateTeam}
          onOpenQuestionSelect={() => setIsQuestionSelectModalOpen(true)}
          onReconnectStudent={handleReconnectStudent}
          onAssignStudent={(studentId, teamId) =>
            apiPost('/api/assign-student', { clientId, studentId, teamId })
          }
          onBulkAssign={(studentIds, teamId) =>
            apiPost('/api/bulk-assign-students', { clientId, studentIds, teamId })
          }
          onMakeLeader={(studentId, teamId) =>
            apiPost('/api/set-team-leader', { clientId, studentId, teamId })
          }
          onKickStudent={(studentId) =>
            apiPost('/api/kick-student', { clientId, studentId })
          }
          onPenalizeTeam={(teamId) =>
            apiPost('/api/penalize-team', { clientId, teamId, points: 5, reason: 'shovqin qilgani uchun' })
          }
          onDeleteTeam={(teamId) =>
            apiPost('/api/delete-team', { clientId, teamId })
          }
        />
      )}

      {/* 3. ACTIVE GAME CONTROLLER PANEL */}
      {phase !== 'LOBBY' && phase !== 'TEAMS_SETUP' && (
        <ActiveGamePanel
          phase={phase}
          round={gameState.currentRound ?? 1}
          currentQuestionIndex={currentQuestionIndex}
          questionsCount={questions.length}
          displayQ={displayQ}
          timerSeconds={timerSeconds}
          teams={teams}
          teamList={teamList}
          students={students}
          winners={gameState.winners ?? []}
          onStartAnswering={() => apiPost('/api/start-answering-phase', { clientId })}
          onStopAnswering={() => apiPost('/api/stop-answering-phase', { clientId })}
          onFinishRound={() => apiPost('/api/finish-round', { clientId })}
          onNextQuestion={() => setIsQuestionSelectModalOpen(true)}
          onEndGame={() => setConfirmState({ kind: 'end-game' })}
          onStopKeepTeams={() => setConfirmState({ kind: 'stop-keep-teams' })}
          onNewRound={() => apiPost('/api/reset-game-keep-teams', { clientId })}
          onPenalizeTeam={(teamId) =>
            apiPost('/api/penalize-team', { clientId, teamId, points: 5, reason: 'shovqin qilgani uchun' })
          }
          onGradeAnswer={(teamId, isCorrect) =>
            apiPost('/api/grade-team-answer', { clientId, teamId, isCorrect })
          }
        />
      )}

      {/* 4. QUESTIONS MANAGER SECTION */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-white text-lg uppercase tracking-tight">
                {t('tv_questions_bank')}
              </h3>
              {isPro && (
                <span className="rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-950 shadow shadow-amber-500/30">
                  {t('tv_pro_badge')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {t('tv_total_questions_prefix')}{questions.length}{t('tv_total_questions_suffix')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {questions.length > 0 && (
              <button
                onClick={() => setConfirmState({ kind: 'delete-all' })}
                className="flex h-10 items-center justify-center gap-1.5 px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all"
                title="Barcha savollarni bazadan o'chirish"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                {t('tv_delete_all')}
              </button>
            )}

            <button
              data-testid="add-question-btn"
              onClick={() => setShowAddQuestion(!showAddQuestion)}
              className="flex h-10 items-center justify-center gap-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('tv_add_question')}
            </button>
          </div>
        </div>

        {/* Add Question Form */}
        {showAddQuestion && (
          <form onSubmit={handleAddQuestion} className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                {t('tv_question_text')}
              </label>
              <input
                type="text"
                required
                data-testid="q-text"
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
                  data-testid="q-opt-a"
                  placeholder={t('tv_variant_a')}
                  value={newOptA}
                  onChange={(e) => setNewOptA(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  data-testid="q-opt-b"
                  placeholder={t('tv_variant_b')}
                  value={newOptB}
                  onChange={(e) => setNewOptB(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  data-testid="q-opt-c"
                  placeholder={t('tv_variant_c')}
                  value={newOptC}
                  onChange={(e) => setNewOptC(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  data-testid="q-opt-d"
                  placeholder={t('tv_variant_d')}
                  value={newOptD}
                  onChange={(e) => setNewOptD(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {t('tv_correct_answer_label')}
                </label>
                <input
                  type="text"
                  required
                  data-testid="q-correct"
                  placeholder={t('tv_correct_placeholder')}
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
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
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
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
                className="h-10 px-4 rounded-xl text-slate-400 hover:text-white text-xs uppercase font-bold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                data-testid="q-save"
                className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.4)]"
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
              className={`h-10 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === 'Barchasi'
                  ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {t('qsm_all')} ({questions.length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab('Oson')}
              className={`h-10 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === 'Oson'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              🟢 {translateDiplicity('Oson', lang)} ({questions.filter((q) => (q.difficulty || "O'rta") === 'Oson').length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab("O'rta")}
              className={`h-10 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDbDifficultyTab === "O'rta"
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              🟡 {translateDiplicity("O'rta", lang)} ({questions.filter((q) => (q.difficulty || "O'rta") === "O'rta").length})
            </button>
            <button
              onClick={() => setActiveDbDifficultyTab('Qiyin')}
              className={`h-10 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            <p className="text-xs text-slate-500 font-mono">{t('tv_bank_empty_sub')}</p>
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
                        <span className={`text-xs px-2 py-0.5 rounded border font-bold uppercase ${diffBadge}`}>
                          {diff === 'Oson' && `🟢 ${translateDiplicity('Oson', lang)}`}
                          {diff === "O'rta" && `🟡 ${translateDiplicity("O'rta", lang)}`}
                          {diff === 'Qiyin' && `🔴 ${translateDiplicity('Qiyin', lang)}`}
                        </span>

                        {isNoOpt ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                            {t('tv_variantless')}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase">
                            {t('tv_test_label')} ({(q.options ?? []).length}{t('tv_variant_unit')})
                          </span>
                        )}

                        {/* Delete single question button */}
                        {confirmDeleteIndex === idx ? (
<div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 px-2 py-1 rounded-lg">
                            <span className="text-xs text-rose-300 font-bold uppercase">{t('tv_delete_confirm')}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuestion(idx);
                              }}
                              className="h-10 w-10 rounded bg-rose-600 text-white hover:bg-rose-500 flex items-center justify-center"
                              title={t('tv_yes')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteIndex(null);
                              }}
                              className="h-10 w-10 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center"
                              title={t('cancel')}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteIndex(idx);
                            }}
                            className="h-10 w-10 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center justify-center"
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

      {/* Unified confirm/alert dialogs (replaces window.confirm/window.alert) */}
      {renderConfirmModal()}

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
