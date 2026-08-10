import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { GameSession, Question, Student, Team } from '../types';
import { Leaderboard } from './Leaderboard';
import { QuestionSelectModal } from './QuestionSelectModal';
import { FeedbackListModal } from './FeedbackListModal';
import {
  Users,
  Shield,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Award,
  Crown,
  Trash2,
  ArrowRight,
  Flame,
  Check,
  RefreshCw,
  Edit3,
  Copy,
  ExternalLink,
  Share2,
  VolumeX,
  UserX,
  AlertTriangle,
  LogOut,
  MessageSquare,
  ArrowLeft,
} from 'lucide-react';

interface TeacherViewProps {
  socket: Socket | null;
  gameState: GameSession | null;
  onResetGame: () => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({
  socket,
  gameState,
  onResetGame,
}) => {
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

  // Custom PIN edit & Link Copy state
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [customPinInput, setCustomPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Deletion confirm states
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  if (!gameState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 animate-bounce">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          O'qituvchi Boshqaruv Paneli
        </h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          O'quvchilar uchun yangi real-time viktorina va chempionat seansini yarating.
        </p>
        <button
          onClick={() => socket?.emit('create_game')}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-xl shadow-orange-500/20 transition-all scale-105 hover:scale-110 cursor-pointer"
        >
          🎮 Yangi O'yin Yaratish (PIN Generatsiya)
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

  const studentList = Object.values(students || {}) as Student[];
  const unassignedStudents = studentList.filter((s) => !s.teamId);
  const teamList = Object.values(teams || {}) as Team[];

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    socket?.emit('create_team', { name: newTeamName.trim() });
    setNewTeamName('');
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');
    const cleanPin = customPinInput.trim();
    if (cleanPin.length !== 6) {
      setPinChangeError("O'yin PIN-kodi (paroli) rosa 6 xonali bo'lishi shart! (Kam ham, ko'p ham bo'lishi mumkin emas)");
      return;
    }

    socket?.emit('update_pin', { newPin: cleanPin }, (res: { success: boolean; pin?: string; message?: string }) => {
      if (res?.success) {
        setIsEditingPin(false);
        setCustomPinInput('');
      } else {
        setPinChangeError(res?.message || 'PIN xatosi yuz berdi');
      }
    });
  };

  const handleCopyStudentLink = () => {
    const studentUrl = `${window.location.origin}/student?pin=${pin}`;
    navigator.clipboard.writeText(studentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
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

    socket?.emit('set_questions', [...questions, newQ]);
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
    socket?.emit('set_questions', updated);
    setConfirmDeleteIndex(null);
  };

  const handleDeleteAllQuestions = () => {
    if (questions.length === 0) return;
    socket?.emit('set_questions', []);
    setConfirmDeleteAll(false);
  };

  const studentFullLink = `${window.location.origin}/student?pin=${pin}`;
  const feedbacks = gameState.feedbacks || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight uppercase">
              O'quvchilar Ulanish Paroli (PIN)
            </h1>
            <p className="text-slate-400 text-xs font-mono tracking-wider">
              O'quvchilar ushbu PIN-kod orqali guruhlariga va o'yinga ulanishadi.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 p-5 sm:px-8 sm:py-5 rounded-2xl border border-indigo-500/40 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
            <div className="text-center sm:text-left">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                O'YIN PAROLI (PIN)
              </div>
              <div className="font-mono font-black text-4xl sm:text-5xl text-indigo-400 tracking-widest leading-none mt-1">
                {pin}
              </div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden sm:block" />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-all uppercase tracking-wider relative cursor-pointer shadow-sm"
                title="O'quvchilar bildirgan barcha fikrlar va baholarni ko'rish"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Fikrlar ({feedbacks.length})</span>
                {feedbacks.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => {
                  setCustomPinInput(pin);
                  setIsEditingPin(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold border border-indigo-400/30 transition-all uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.3)] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Parolni O'zgartirish
              </button>

              <button
                onClick={onResetGame}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 transition-all uppercase tracking-wider cursor-pointer"
                title="Bosh sahifaga qaytish va yangi o'yin boshlash"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
                Bosh Sahifaga Qaytish
              </button>
            </div>
          </div>
        </div>
      </div>

      {isEditingPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Parol (PIN-kod)ni O'zgartirish
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  O'quvchilar doskaga qarab oson kirishi uchun o'zingiz xohlagan kodni yozing
                </p>
              </div>
            </div>

            {pinChangeError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {pinChangeError}
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Yangi Parol / PIN-kod (Masalan: 849201 yoki 123456)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={customPinInput}
                  onChange={(e) => {
                    setPinChangeError('');
                    setCustomPinInput(e.target.value);
                  }}
                  placeholder="Masalan: 849201"
                  className="w-full text-center tracking-widest font-mono font-bold text-2xl px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-indigo-400 focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPin(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={customPinInput.trim().length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(phase === 'LOBBY' || phase === 'TEAMS_SETUP') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base uppercase tracking-wider">
                  Kutish Zali
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                {unassignedStudents.length} TA
              </span>
            </div>

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
                    <span>Barchasini belgilash ({selectedStudentIds.length})</span>
                  </label>

                  {selectedStudentIds.length > 0 && (
                    <button
                      onClick={() => setSelectedStudentIds([])}
                      className="text-[10px] text-slate-400 hover:text-white uppercase font-bold"
                    >
                      Tozalash
                    </button>
                  )}
                </div>

                {selectedStudentIds.length > 0 && teamList.length > 0 && (
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase">Guruhga biriktirish:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          socket?.emit('bulk_assign_students', {
                            studentIds: selectedStudentIds,
                            teamId: e.target.value,
                          });
                          setSelectedStudentIds([]);
                          e.target.value = '';
                        }
                      }}
                      className="flex-1 px-2 py-1 rounded bg-indigo-600 text-white font-bold text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="">Guruhni tanlang...</option>
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
                Barcha o'quvchilar guruhlarga taqsimlandi yoki hali hech kim ulanmadi.
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
                          onClick={() => socket?.emit('kick_student', { studentId: st.id })}
                          className="p-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                          title="Tizimdan/o'yindan chiqarib yuborish"
                        >
                          <UserX className="w-3 h-3" />
                          Chiqarish
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-xl uppercase tracking-tight">
                    Guruhlarni Shakllantirish va Sardor Tayinlash
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    O'quvchilarni guruhlarga bir nechta ketma-ket kiritishingiz va adashib kirganlarni o'yindan chiqarishingiz mumkin.
                  </p>
                </div>

                {teamList.length > 0 && (
                  <button
                    onClick={() => setIsQuestionSelectModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all scale-105 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    Viktorinani Boshlash (Savol Tanlash)
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateTeam} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Yangi guruh nomi (Masalan: Algoritmlar...)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 w-full"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(79,70,229,0.4)] flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Guruh Qo'shish
                </button>
              </form>

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
                            onClick={() => socket?.emit('penalize_team', { teamId: team.id, points: 5, reason: 'shovqin qilgani uchun' })}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[10px] font-bold uppercase transition-all cursor-pointer"
                            title="Shovqin qilgani uchun 5 ball ayirish"
                          >
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            -5 Ball (Shovqin)
                          </button>

                          <button
                            onClick={() => socket?.emit('delete_team', { teamId: team.id })}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Guruhni o'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 pl-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Guruh a'zolari va Sardor:
                        </div>
                        {team.memberIds.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">
                            A'zolar yo'q. Quyidan o'quvchi biriktiring.
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
                                  <div className="flex items-center gap-2">
                                    {isLeader && (
                                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                                    )}
                                    <span className="font-semibold">{st.name}</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {!isLeader && (
                                      <button
                                        onClick={() =>
                                          socket?.emit('set_team_leader', {
                                            studentId: st.id,
                                            teamId: team.id,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[10px] font-bold uppercase cursor-pointer"
                                      >
                                        Sardor qilish
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        socket?.emit('assign_student', {
                                          studentId: st.id,
                                          teamId: null,
                                        })
                                      }
                                      className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                                      title="Guruhdan chiqarib, kutish zaliga qaytarish"
                                    >
                                      <LogOut className="w-3 h-3 text-amber-400" />
                                      <span>Kutish zaliga</span>
                                    </button>
                                    <button
                                      onClick={() => socket?.emit('kick_student', { studentId: st.id })}
                                      className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
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

                      {unassignedStudents.length > 0 && (
                        <div className="pt-2 border-t border-white/5 pl-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                socket?.emit('assign_student', {
                                  studentId: e.target.value,
                                  teamId: team.id,
                                });
                                e.target.value = '';
                              }
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="">+ O'quvchini guruhga qo'shish...</option>
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

      {phase !== 'LOBBY' && phase !== 'TEAMS_SETUP' && (() => {
        const activeTeams = teamList.filter((t) => !t.isEliminated);
        const teamsWithBets = activeTeams.filter((t) => t.currentBet !== null);
        const allBetPlaced = activeTeams.length > 0 && teamsWithBets.length === activeTeams.length;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                      Savol {currentQuestionIndex + 1} / {questions.length}
                    </span>
                    <div className="text-xs text-slate-400 font-mono uppercase">
                      Bosqich:{' '}
                      <span className="font-bold text-indigo-400">
                        {phase === 'BETTING' && '1. Ball Tikish Bosqichi'}
                        {phase === 'ANSWERING' && '2. Javob Berish (Taymer Ishlamoqda)'}
                        {phase === 'GRADING' && '3. Javoblarni Baholash'}
                        {phase === 'ROUND_RESULT' && '4. Raund Yakunlandi'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {phase === 'BETTING' && (
                      <button
                        onClick={() => socket?.emit('start_answering_phase')}
                        disabled={!allBetPlaced}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                          allBetPlaced
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-105'
                            : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
                        }`}
                        title={!allBetPlaced ? "Barcha guruhlar ball tikmaguncha boshlab bo'lmaydi!" : "Taymerni va javob berishni boshlash"}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        BOSHLASH (Taymer va Javobni Ochish)
                      </button>
                    )}

                    {phase === 'ANSWERING' && (
                      <button
                        onClick={() => socket?.emit('stop_answering_phase')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer"
                      >
                        <Clock className="w-4 h-4" />
                        Taymerni To'xtatish va Baholash
                      </button>
                    )}

                    {phase === 'GRADING' && (
                      <button
                        onClick={() => socket?.emit('finish_round')}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Raund Natijalarini E'lon Qilish
                      </button>
                    )}

                    {phase === 'ROUND_RESULT' && (
                      <button
                        onClick={() => setIsQuestionSelectModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.5)] cursor-pointer"
                      >
                        Keyingi Savol (Tanlash) <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (window.confirm("O'yinni to'xtatmoqchimisiz? Barcha guruhlar va o'quvchilar saqlanib qoladi!")) {
                          socket?.emit('reset_game_keep_teams');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                      title="O'yinni to'xtatish va guruhlar bo'limiga qaytish (Guruhlar va o'quvchilar saqlanadi)"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      O'yinni Tugatish (Guruhlar Saqlanadi)
                    </button>
                  </div>
                </div>

                {phase === 'BETTING' && (
                  <div className="w-full pt-1">
                    {allBetPlaced ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>BALLAR 100% TIKILDI! ({teamsWithBets.length}/{activeTeams.length} guruh ball tikdi). Endi Boshlash tugmasini bosishingiz mumkin!</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-mono bg-emerald-500/30 px-2.5 py-1 rounded text-emerald-200 shrink-0 font-extrabold">
                          100% TIKILDI
                        </span>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>BALLAR TIKILMADI! Hali barcha guruhlar ball tikib bo'lmadi ({teamsWithBets.length}/{activeTeams.length} guruh tikdi).</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-mono bg-amber-500/30 px-2.5 py-1 rounded text-amber-200 shrink-0 font-extrabold">
                          TIKILMOQDA...
                        </span>
                      </div>
                    )}
                  </div>
                )}

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
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          ⏱️ Taymer Ishlamoqda (Vaqt Sanalmoqda)
                        </div>
                        <div className="text-3xl font-black font-mono tracking-tight flex items-baseline gap-2">
                          <span>{timerSeconds}</span>
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">soniya qoldi</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right">
                      <span className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-block ${
                        timerSeconds <= 5 
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                          : 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/50 shadow-[0_0_12px_rgba(79,70,229,0.3)]'
                      }`}>
                        {timerSeconds <= 5 ? "⚠️ SHOSHILING! VAQT TUGAMOQDA" : "⏳ JAVOB BERISH VAQTI"}
                      </span>
                    </div>
                  </div>
                )}

                {currentQ && (
                  <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400">
                      <span>{currentQ.category} • Vaqt: {currentQ.timeLimit}s</span>
                      {phase === 'ANSWERING' && (
                        <span className="text-amber-400 font-black animate-pulse">
                          ⏱️ {timerSeconds}s
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-serif text-white">
                      {currentQ.text}
                    </h3>
                    <div className="text-xs text-emerald-400 font-medium pt-2 border-t border-white/10">
                      To'g'ri javob: <span className="font-bold text-white">{currentQ.correctAnswer}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md">
                <h3 className="font-bold text-white text-lg uppercase tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  Jamoalar Tikkan Ballari va Javoblari
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
                              ({team.score} ball)
                            </span>

                            <button
                              onClick={() => socket?.emit('penalize_team', { teamId: team.id, points: 5, reason: 'shovqin qilgani uchun' })}
                              className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-[10px] font-bold uppercase transition-all cursor-pointer"
                              title="Shovqin va intizomsizlik uchun 5 ball ayirish"
                            >
                              <VolumeX className="w-3 h-3 text-rose-400" />
                              -5 Ball (Shovqin)
                            </button>
                          </div>

                          <div className="mt-1 text-xs text-slate-300">
                            Tikilgan Ball:{' '}
                            <span className="font-mono font-bold text-amber-400">
                              {team.currentBet !== null ? `${team.currentBet} ball` : 'Kiritilmadi'}
                            </span>
                          </div>

                          <div className="mt-1 text-sm font-semibold text-white">
                            Javob:{' '}
                            <span className="text-indigo-200">
                              {team.currentAnswer || '(Hali javob berilmadi)'}
                            </span>
                          </div>
                        </div>

                        {phase === 'GRADING' && team.currentBet !== null && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                socket?.emit('grade_team_answer', {
                                  teamId: team.id,
                                  isCorrect: true,
                                })
                              }
                              className={`p-2.5 rounded-xl border text-xs font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                                team.lastResult?.isCorrect === true
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" /> To'g'ri
                            </button>

                            <button
                              onClick={() =>
                                socket?.emit('grade_team_answer', {
                                  teamId: team.id,
                                  isCorrect: false,
                                })
                              }
                              className={`p-2.5 rounded-xl border text-xs font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                                team.lastResult?.isCorrect === false
                                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              }`}
                            >
                              <XCircle className="w-4 h-4" /> Xato
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <Leaderboard teams={teams} students={students} currentPhase={phase} />
            </div>
          </div>
        );
      })()}

      {/* 4. QUESTIONS DATABASE & QUESTION MANAGEMENT SECTION */}
      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white text-xl uppercase tracking-tight flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              Savollar Bazasi va Boshqarish ({questions.length} ta)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Savollarni o'zingiz qo'lda qo'shishingiz hamda qiyinchilik darajalari bo'yicha saralashingiz mumkin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddQuestion(!showAddQuestion)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddQuestion ? "Yopish" : "Qo'lda Savol Qo'shish"}</span>
            </button>

            {questions.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                title="Barcha savollarni o'chirib tashlash"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Barchasini O'chirish</span>
              </button>
            )}
          </div>
        </div>

        {/* DIFFICULTY FILTER TABS FOR QUESTION DATABASE */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-950/80 p-2 rounded-2xl border border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">
              Daraja bo'yicha saralash:
            </span>
            {(['Barchasi', 'Oson', "O'rta", 'Qiyin'] as const).map((tab) => {
              const count = tab === 'Barchasi' 
                ? questions.length 
                : questions.filter(q => q.difficulty === tab || (tab === "O'rta" && !q.difficulty)).length;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveDbDifficultyTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 uppercase tracking-wider cursor-pointer ${
                    activeDbDifficultyTab === tab
                      ? tab === 'Oson'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : tab === "O'rta"
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : tab === 'Qiyin'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                        : 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]'
                      : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{tab}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-[10px] font-mono font-bold">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Add Question Form */}
        {showAddQuestion && (
          <form onSubmit={handleAddQuestion} className="p-6 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="font-bold text-white text-base uppercase tracking-wider">
                Yangi Savol Qo'shish (Forma)
              </h4>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Qiyinchilik Darajasi:</span>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="Oson">🟢 Oson (Easy)</option>
                  <option value="O'rta">🟡 O'rta (Medium)</option>
                  <option value="Qiyin">🔴 Qiyin (Hard)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Savol Matni:
              </label>
              <textarea
                rows={2}
                required
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Savol matnini bu yerga yozing..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOptionless"
                checked={isOptionless}
                onChange={(e) => setIsOptionless(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
              />
              <label htmlFor="isOptionless" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Variantsiz Ochiq Savol (O'quvchi javobni o'zi yozadi)
              </label>
            </div>

            {!isOptionless && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newOptA}
                  onChange={(e) => setNewOptA(e.target.value)}
                  placeholder="Variant A..."
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
                <input
                  type="text"
                  value={newOptB}
                  onChange={(e) => setNewOptB(e.target.value)}
                  placeholder="Variant B..."
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
                <input
                  type="text"
                  value={newOptC}
                  onChange={(e) => setNewOptC(e.target.value)}
                  placeholder="Variant C..."
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
                <input
                  type="text"
                  value={newOptD}
                  onChange={(e) => setNewOptD(e.target.value)}
                  placeholder="Variant D..."
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  To'g'ri Javob Matni:
                </label>
                <input
                  type="text"
                  required
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  placeholder="To'g'ri javob matni..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-emerald-400 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Ajratilgan Vaqt (soniyada):
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  max={120}
                  value={newTime}
                  onChange={(e) => setNewTime(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-bold text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_12px_rgba(79,70,229,0.4)] cursor-pointer"
            >
              + Bazaga Qo'shish
            </button>
          </form>
        )}

        {/* Questions List */}
        {questions.length === 0 ? (
          <p className="text-center text-xs text-slate-500 font-mono py-8 uppercase tracking-widest">
            Savollar bazasi bo'sh. AI orqali generatsiya qiling yoki qo'lda qo'shing.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions
              .filter((q) => {
                if (activeDbDifficultyTab === 'Barchasi') return true;
                if (activeDbDifficultyTab === "O'rta") return q.difficulty === "O'rta" || !q.difficulty;
                return q.difficulty === activeDbDifficultyTab;
              })
              .map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2 relative group hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-400">#{idx + 1}</span>
                      <span>• {q.timeLimit} soniya</span>
                      {q.difficulty && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          q.difficulty === 'Oson'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : q.difficulty === "O'rta"
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setConfirmDeleteIndex(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      title="Savolni o'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {q.text}
                  </p>

                  <div className="text-xs text-emerald-400 font-medium pt-1 border-t border-white/5">
                    To'g'ri javob: <span className="font-bold text-white">{q.correctAnswer}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE ALL MODAL */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Barcha Savollarni O'chirish
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Haqiqatdan ham bazadagi barcha {questions.length} ta savolni o'chirib tashlamoqchimisiz?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Bekor Qilish
              </button>
              <button
                onClick={handleDeleteAllQuestions}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all cursor-pointer"
              >
                Ha, Barchasini O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINGLE QUESTION MODAL */}
      {confirmDeleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Savolni O'chirish
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  #{confirmDeleteIndex + 1}-sonli savolni bazadan o'chirmoqchimisiz?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteIndex(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Bekor Qilish
              </button>
              <button
                onClick={() => handleDeleteQuestion(confirmDeleteIndex)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all cursor-pointer"
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION SELECTION MODAL BEFORE ROUND */}
      <QuestionSelectModal
        isOpen={isQuestionSelectModalOpen}
        onClose={() => setIsQuestionSelectModalOpen(false)}
        questions={questions}
        onSelectQuestion={(qIndex) => {
          socket?.emit('start_round_with_question', { questionIndex: qIndex });
          setIsQuestionSelectModalOpen(false);
        }}
      />

      {/* FEEDBACK LIST MODAL */}
      <FeedbackListModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        feedbacks={feedbacks}
      />
    </div>
  );
};
