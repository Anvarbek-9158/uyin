import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameSession } from './types';
import { Navbar } from './components/Navbar';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { sounds } from './utils/soundEffects';
import {
  Sparkles,
  ArrowLeft,
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

  // Keep sound preference accessible inside socket event handlers without reconnecting the socket
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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

  // Change Password Modal show/hide toggles
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Change Password Modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);

  // Initialize socket connection (created once; sound changes must not reset the connection)
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
      if (soundEnabledRef.current && seconds <= 5 && seconds > 0) {
        sounds.playTick();
      }
      setGameState((prev) => (prev ? { ...prev, timerSeconds: seconds } : prev));
    });

    newSocket.on('notification', (data) => {
      setNotification(data);
      setTimeout(() => setNotification(null), 4000);
    });

    newSocket.on('bet_placed', () => {
      if (soundEnabledRef.current) sounds.playBet();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

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
    if (newPasswordInput.trim().length < 4) {
      setChangePasswordError("Yangi parol kamida 4 ta belgidan iborat bo'lishi shart!");
      return;
    }
    if (newPasswordInput.trim().length > 20) {
      setChangePasswordError("Yangi parol ko'pi bilan 20 ta belgidan iborat bo'lishi mumkin!");
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

    // Save new teacher password persistently in localStorage
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

  // Sound triggers on phase changes
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

  return (
    <div className="min-h-screen bg-[#0B1121] text-[#F8FAFC] flex flex-col font-sans max-w-full overflow-x-hidden selection:bg-[#0EA5E9] selection:text-[#0B1121]">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-[#0B1121]/90 border border-[#0EA5E9]/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-fade-in flex items-center gap-3 max-w-[calc(100vw-2rem)]">
          <div className="p-2 rounded-xl bg-[#0EA5E9]/20 text-[#0EA5E9] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#F8FAFC] break-words min-w-0">{notification.text}</p>
        </div>
      )}

      {/* Main Top Navigation Bar */}
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

      {/* CHANGE PASSWORD MODAL DIALOG */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1121]/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#0B1121]/90 border border-[#0EA5E9]/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative overflow-hidden my-auto">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#FBBF24]/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FBBF24]/20 border border-[#FBBF24]/30 text-[#FBBF24] flex items-center justify-center font-bold shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[#F8FAFC] uppercase tracking-tight">
                    Parolni O'zgartirish
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
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
                className="text-[#94A3B8] hover:text-[#F8FAFC] p-1 rounded-lg bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[#FB7185] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FB7185]" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34D399]" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 relative z-10">
              {/* 1. Eski Parol */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
                  1) Eski Parol
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={oldPasswordInput}
                    onChange={(e) => {
                      setOldPasswordInput(e.target.value);
                      setChangePasswordError(null);
                    }}
                    placeholder="Amaldagi eski parolni kiriting..."
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showOldPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. Yangi Parol */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
                  2) Yangi Parol (kamida 4 belgi)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    maxLength={20}
                    autoComplete="new-password"
                    value={newPasswordInput}
                    onChange={(e) => {
                      setNewPasswordInput(e.target.value);
                      setChangePasswordError(null);
                    }}
                    placeholder="Yangi parolni kiriting..."
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showNewPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 3. Yangi Parolni Takrorlash */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
                  3) Yangi Parolni Takrorlang
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    maxLength={20}
                    autoComplete="new-password"
                    value={confirmPasswordInput}
                    onChange={(e) => {
                      setConfirmPasswordInput(e.target.value);
                      setChangePasswordError(null);
                    }}
                    placeholder="Yangi parolni qayta kiriting..."
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
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
                  className="flex-1 py-3 rounded-xl bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 border border-[#0EA5E9]/30 text-[#94A3B8] hover:text-[#F8FAFC] font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#FBBF24] hover:bg-[#FCD34D] text-[#0B1121] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {/* TEACHER PASSWORD AUTHENTICATION SCREEN */}
        {showTeacherPasswordModal ? (
          <div className="min-h-[75vh] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0B1121]/90 border border-[#0EA5E9]/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-48 h-48 bg-[#0EA5E9]/20 blur-3xl rounded-full pointer-events-none" />

              {/* Back Arrow Button */}
              <div className="flex items-center justify-between relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherPasswordModal(false);
                    setTeacherPasswordError(null);
                    setTeacherPasswordInput('');
                    handleSetViewMode('STUDENT');
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 border border-[#0EA5E9]/30 text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 text-[#0EA5E9]" />
                  <span>Orqaga (O'quvchi Tizimi)</span>
                </button>
              </div>

              {/* Lock Icon & Title */}
              <div className="text-center space-y-2 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#0EA5E9]/30 border border-[#0EA5E9]/50 text-[#0EA5E9] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(14,165,233,0.3)] font-black">
                  <Lock className="w-8 h-8 text-[#0EA5E9]" />
                </div>
                <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight uppercase">
                  O'qituvchi Paroli
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  O'qituvchi boshqaruv paneliga kirish uchun parolni kiriting
                </p>
              </div>

              {teacherPasswordError && (
                <div className="p-3.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[#FB7185] text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teacherPasswordError}</span>
                </div>
              )}

              {/* Password Form */}
              <form onSubmit={handleTeacherPasswordSubmit} className="space-y-4 relative z-10">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1.5">
                    O'qituvchi Paroli
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? "text" : "password"}
                      required
                      autoFocus
                      autoComplete="current-password"
                      value={teacherPasswordInput}
                      onChange={(e) => {
                        setTeacherPasswordInput(e.target.value);
                        setTeacherPasswordError(null);
                      }}
                      placeholder="Parolni kiriting..."
                      className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono font-bold text-base focus:outline-none focus:border-[#0EA5E9] shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
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
                    className="flex-1 py-3.5 rounded-2xl bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 border border-[#0EA5E9]/30 text-[#94A3B8] hover:text-[#F8FAFC] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Orqaga
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-[#FBBF24] hover:bg-[#FCD34D] text-[#0B1121] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-2"
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
            {/* TEACHER ADMIN PANEL */}
            {viewMode === 'TEACHER' && isTeacherAuth && (
              <TeacherView
                socket={socket}
                gameState={gameState}
                onResetGame={handleResetGame}
              />
            )}

            {/* STUDENT PANEL (DEFAULT) */}
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

      {/* Modern Footer */}
      <footer className="bg-[#0B1121]/80 border-t border-white/5 py-6 text-center text-xs text-[#94A3B8] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <p className="break-words">© 2026 Raqamli Viktorina — Real-Time O'quv va Chempionat Platformasi</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[#94A3B8] uppercase tracking-widest text-[11px]">
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
