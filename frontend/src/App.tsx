import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameSession } from './types';
import { Navbar } from './components/Navbar';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { sounds } from './utils/soundEffects';
import {
  Award,
  Shield,
  User,
  Sparkles,
  Zap,
  Users,
  Trophy,
  Flame,
  ArrowRight,
  ArrowLeft,
  Tv,
  CheckCircle2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [viewMode, setViewMode] = useState<'LANDING' | 'TEACHER' | 'STUDENT'>('STUDENT');
  const [gameState, setGameState] = useState<GameSession | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notification, setNotification] = useState<{ type: string; text: string } | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Teacher Authentication state
  const [isTeacherAuth, setIsTeacherAuth] = useState<boolean>(() => {
    return sessionStorage.getItem('teacher_auth') === 'true';
  });
  const [teacherPassword, setTeacherPassword] = useState<string>(() => {
    return localStorage.getItem('teacher_app_password') || 'anvarbek_1307';
  });
  const [showTeacherPasswordModal, setShowTeacherPasswordModal] = useState(false);
  const [teacherPasswordInput, setTeacherPasswordInput] = useState('');
  const [teacherPasswordError, setTeacherPasswordError] = useState<string | null>(null);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Change Password Modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('⚡ Socket connected:', newSocket.id);
    });

    newSocket.on('game_state', (state: GameSession) => {
      setGameState(state);
    });

    newSocket.on('timer_tick', (seconds: number) => {
      if (soundEnabled && seconds <= 5 && seconds > 0) {
        sounds.playTick();
      }
      setGameState((prev) => (prev ? { ...prev, timerSeconds: seconds } : prev));
    });

    newSocket.on('notification', (data) => {
      setNotification(data);
      setTimeout(() => setNotification(null), 4000);
    });

    newSocket.on('bet_placed', () => {
      if (soundEnabled) sounds.playBet();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [soundEnabled]);

  // URL route detection (/student, /teacher)
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const path = window.location.pathname.toLowerCase();

      if (path.includes('/teacher')) {
        const isAuth = sessionStorage.getItem('teacher_auth') === 'true';
        if (isAuth) {
          setIsTeacherAuth(true);
          setViewMode('TEACHER');
          setShowTeacherPasswordModal(false);
          if (socket && !gameState) {
            socket.emit('create_game');
          }
        } else {
          setViewMode('STUDENT');
          setShowTeacherPasswordModal(true);
        }
      } else {
        setViewMode('STUDENT');
        setShowTeacherPasswordModal(false);
      }
    };

    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => window.removeEventListener('popstate', syncRouteFromUrl);
  }, [socket, gameState]);

  // Auto-create game session when teacher mode is active
  useEffect(() => {
    if (viewMode === 'TEACHER' && isTeacherAuth && socket && !gameState) {
      socket.emit('create_game');
    }
  }, [viewMode, isTeacherAuth, socket, gameState]);

  // Navigation handler with URL sync & password protection
  const handleSetViewMode = (mode: 'LANDING' | 'TEACHER' | 'STUDENT') => {
    if (mode === 'TEACHER') {
      if (isTeacherAuth) {
        setViewMode('TEACHER');
        setShowTeacherPasswordModal(false);
        window.history.pushState({}, '', '/teacher');
        if (socket && !gameState) {
          socket.emit('create_game');
        }
      } else {
        setShowTeacherPasswordModal(true);
      }
    } else {
      setViewMode('STUDENT');
      setShowTeacherPasswordModal(false);
      const pinQuery = gameState?.pin ? `?pin=${gameState.pin}` : '';
      window.history.pushState({}, '', `/student${pinQuery}`);
    }
  };

  const handleTeacherPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherPasswordInput === teacherPassword) {
      setIsTeacherAuth(true);
      sessionStorage.setItem('teacher_auth', 'true');
      setShowTeacherPasswordModal(false);
      setTeacherPasswordError(null);
      setTeacherPasswordInput('');
      setViewMode('TEACHER');
      window.history.pushState({}, '', '/teacher');
      if (socket && !gameState) {
        socket.emit('create_game');
      }
    } else {
      setTeacherPasswordError("Xato parol! O'qituvchi paroli noto'g'ri.");
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (oldPasswordInput !== teacherPassword) {
      setChangePasswordError("Eski parol noto'g'ri kiritildi!");
      return;
    }
    if (newPasswordInput.trim().length !== 6) {
      setChangePasswordError("Yangi parol rosa 6 xonali bo'lishi shart! (Kam ham, ko'p ham bo'lishi mumkin emas)");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError("Yangi parol va takroriy parol bir-biriga mos kelmadi!");
      return;
    }
    if (newPasswordInput === oldPasswordInput) {
      setChangePasswordError("Yangi parol eski parol bilan bir xil bo'la olmaydi!");
      return;
    }

    localStorage.setItem('teacher_app_password', newPasswordInput.trim());
    setTeacherPassword(newPasswordInput.trim());
    setChangePasswordSuccess("O'qituvchi paroli muvaffaqiyatli o'zgartirildi!");
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setTimeout(() => {
      setShowChangePasswordModal(false);
      setChangePasswordSuccess(null);
    }, 1800);
  };

  const handleTeacherLogout = () => {
    setIsTeacherAuth(false);
    sessionStorage.removeItem('teacher_auth');
    setViewMode('STUDENT');
    setShowTeacherPasswordModal(false);
    window.history.pushState({}, '', '/student');
  };

  useEffect(() => {
    if (!gameState || !soundEnabled) return;

    if (gameState.phase === 'ANSWERING') {
      sounds.playPhaseStart();
    } else if (gameState.phase === 'GAME_OVER') {
      sounds.playVictory();
    }
  }, [gameState?.phase, soundEnabled]);

  const handleResetGame = () => {
    if (socket) {
      socket.emit('reset_game');
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-white">{notification.text}</p>
        </div>
      )}

      <Navbar
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        pin={gameState?.pin || null}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onResetGame={handleResetGame}
        isTeacherAuth={isTeacherAuth}
        onLogoutTeacher={handleTeacherLogout}
        onChangePasswordTeacher={() => setShowChangePasswordModal(true)}
      />

      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                    Parolni O'zgartirish
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O'qituvchi parolini yangilash
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setChangePasswordError(null);
                  setChangePasswordSuccess(null);
                  setOldPasswordInput('');
                  setNewPasswordInput('');
                  setConfirmPasswordInput('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  1) Eski Parol
                </label>
                <input
                  type="password"
                  required
                  value={oldPasswordInput}
                  onChange={(e) => {
                    setOldPasswordInput(e.target.value);
                    setChangePasswordError(null);
                  }}
                  placeholder="Amaldagi eski parolni kiriting..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  2) Yangi Parol (6 xonali)
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    setChangePasswordError(null);
                  }}
                  placeholder="Yangi 6 xonali parolni kiriting..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  3) Yangi Parolni Takrorlang (6 xonali)
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={confirmPasswordInput}
                  onChange={(e) => {
                    setConfirmPasswordInput(e.target.value);
                    setChangePasswordError(null);
                  }}
                  placeholder="Yangi parolni qayta kiriting..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setChangePasswordError(null);
                    setChangePasswordSuccess(null);
                    setOldPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1">
        {showTeacherPasswordModal ? (
          <div className="min-h-[75vh] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-48 h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherPasswordModal(false);
                    setTeacherPasswordError(null);
                    setTeacherPasswordInput('');
                    handleSetViewMode('STUDENT');
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-400" />
                  <span>Orqaga (O'quvchi Tizimi)</span>
                </button>

                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  O'qituvchi Himoyasi
                </span>
              </div>

              <div className="text-center space-y-2 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(79,70,229,0.3)] font-black">
                  <Lock className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight uppercase">
                  O'qituvchi Paroli
                </h2>
                <p className="text-xs text-slate-400">
                  O'qituvchi boshqaruv paneliga kirish uchun parolni kiriting
                </p>
              </div>

              {teacherPasswordError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teacherPasswordError}</span>
                </div>
              )}

              <form onSubmit={handleTeacherPasswordSubmit} className="space-y-4 relative z-10">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    O'qituvchi Paroli
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? "text" : "password"}
                      required
                      autoFocus
                      value={teacherPasswordInput}
                      onChange={(e) => {
                        setTeacherPasswordInput(e.target.value);
                        setTeacherPasswordError(null);
                      }}
                      placeholder="Parolni kiriting..."
                      className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
                      title={showPasswordText ? "Yashirish" : "Ko'rsatish"}
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherPasswordModal(false);
                      setTeacherPasswordError(null);
                      setTeacherPasswordInput('');
                      handleSetViewMode('STUDENT');
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Orqaga
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    Kirish
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'TEACHER' && isTeacherAuth && (
              <TeacherView
                socket={socket}
                gameState={gameState}
                onResetGame={handleResetGame}
              />
            )}

            {viewMode === 'STUDENT' && (
              <StudentView
                socket={socket}
                gameState={gameState}
                initialPin={gameState?.pin || ''}
                onTeacherClick={() => setShowTeacherPasswordModal(true)}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-slate-950/80 border-t border-white/5 py-6 text-center text-xs text-slate-500 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <p>© 2026 Raqamli Viktorina — Real-Time O'quv va Chempionat Platformasi</p>
          <div className="flex items-center gap-4 text-slate-400 uppercase tracking-widest text-[10px]">
            <span>Node.js</span>
            <span>Socket.io</span>
            <span>Express</span>
            <span>React</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
