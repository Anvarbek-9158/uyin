import React, { useState, useEffect, useRef } from 'react';
import { Channel } from 'pusher-js';
import { GameSession } from './types';
import { Navbar } from './components/Navbar';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { sounds } from './utils/soundEffects';
import { apiPost, apiGet, getClientId, setSessionToken } from './utils/api';
import { pusher, teacherGameChannelName } from './utils/pusher';
import { useHeartbeat } from './utils/useHeartbeat';
import { useLang } from './i18n';
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
  const { t } = useLang();
  const [clientId] = useState<string>(() => getClientId());
  const [channel, setChannel] = useState<Channel | null>(null);
  const [viewMode, setViewMode] = useState<'LANDING' | 'TEACHER' | 'STUDENT'>('STUDENT');
  const [gameState, setGameState] = useState<GameSession | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notification, setNotification] = useState<{ type: string; text: string } | null>(null);

  // Keep sound preference accessible inside Pusher event handlers without re-subscribing
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

  // Subscribe to the game channel via Pusher whenever the game PIN changes.
  //
  // A teacher and a student must NOT receive the same payload: the teacher gets
  // the full state (question, correct answer, every team's answer) on the
  // teacher-private channel, while students only get the sanitized state on the
  // shared game channel. Which channel we join depends on the current view mode,
  // so we re-subscribe whenever the pin OR the mode changes. The reconcile pull
  // (/api/game-state) is role-filtered too.
  useEffect(() => {
    const pin = gameState?.pin;
    if (!pin) return;

    const isTeacherMode = viewMode === 'TEACHER' && isTeacherAuth;
    const channelName = isTeacherMode ? teacherGameChannelName(pin) : `game-${pin}`;
    const gameChannel = pusher.subscribe(channelName);
    setChannel(isTeacherMode ? null : gameChannel);

    const onGameState = (state: GameSession) => {
      setGameState(state);
    };

    const onTick = (seconds: number) => {
      if (soundEnabledRef.current && seconds <= 5 && seconds > 0) {
        sounds.playTick();
      }
      setGameState((prev) => (prev ? { ...prev, timerSeconds: seconds } : prev));
    };

    const onNotification = (data: { type: string; text: string }) => {
      setNotification(data);
      setTimeout(() => setNotification(null), 4000);
    };

    const onBetPlaced = () => {
      if (soundEnabledRef.current) sounds.playBet();
    };

    // Reconcile authoritative state once the channel subscription is live.
    // Pusher does not replay events that were broadcast before this client was
    // actually subscribed. Pulling the current state on subscription success
    // (and again after every reconnect) recovers any missed event. The pull is
    // role-filtered server-side, so it matches the channel we are on.
    let cancelled = false;
    const reconcile = async () => {
      if (cancelled) return;
      try {
        const res = await apiGet<{ success: boolean; game?: GameSession }>(
          `/api/game-state?clientId=${encodeURIComponent(clientId)}`
        );
        if (cancelled) return;
        if (res?.success && res.game) {
          setGameState(res.game);
        }
      } catch {
        // The next live event or subscription will reconcile again.
      }
    };

    gameChannel.bind('game_state', onGameState);
    gameChannel.bind('timer_tick', onTick);
    gameChannel.bind('notification', onNotification);
    gameChannel.bind('bet_placed', onBetPlaced);
    gameChannel.bind('pusher:subscription_succeeded', reconcile);
    if (gameChannel.subscribed) {
      reconcile();
    }

    return () => {
      cancelled = true;
      gameChannel.unbind('game_state', onGameState);
      gameChannel.unbind('timer_tick', onTick);
      gameChannel.unbind('notification', onNotification);
      gameChannel.unbind('bet_placed', onBetPlaced);
      gameChannel.unbind('pusher:subscription_succeeded', reconcile);
      setChannel(null);
      pusher.unsubscribe(channelName);
    };
  }, [clientId, gameState?.pin, viewMode, isTeacherAuth]);

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
  }, []);

  // Create a new game session via REST when teacher mode is active
  const handleCreateGame = async () => {
    const res = await apiPost<{ success: boolean; game?: GameSession; sessionToken?: string }>(
      '/api/create-game',
      {
        clientId,
      }
    );
    if (res.success && res.game) {
      if (res.sessionToken) setSessionToken(res.sessionToken);
      setGameState(res.game);
    }
  };

  // Auto-create game session when teacher mode is active
  useEffect(() => {
    if (viewMode === 'TEACHER' && isTeacherAuth && !gameState) {
      handleCreateGame();
    }
  }, [viewMode, isTeacherAuth, gameState]);

  // Navigation handler with URL sync & password protection
  const handleSetViewMode = (mode: 'LANDING' | 'TEACHER' | 'STUDENT') => {
    if (mode === 'TEACHER') {
      if (isTeacherAuth) {
        setViewMode('TEACHER');
        setShowTeacherPasswordModal(false);
        window.history.pushState({}, '', '/teacher');
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
    } else {
      setTeacherPasswordError(t('wrong_password'));
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (oldPasswordInput !== teacherPassword) {
      setChangePasswordError(t('err_old_wrong'));
      return;
    }
    if (newPasswordInput.trim().length < 4) {
      setChangePasswordError(t('err_new_short'));
      return;
    }
    if (newPasswordInput.trim().length > 20) {
      setChangePasswordError(t('err_new_long'));
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError(t('err_new_mismatch'));
      return;
    }
    if (newPasswordInput === oldPasswordInput) {
      setChangePasswordError(t('err_new_same'));
      return;
    }

    // Save new teacher password persistently in localStorage
    localStorage.setItem('teacher_app_password', newPasswordInput.trim());
    setTeacherPassword(newPasswordInput.trim());
    setChangePasswordSuccess(t('success_password'));
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

  const handleResetGame = async () => {
    const res = await apiPost<{ success: boolean; game?: GameSession }>('/api/reset-game', {
      clientId,
    });
    if (res.success && res.game) {
      setGameState(res.game);
    }
  };

  const handleGameStateChange = (state: GameSession) => {
    setGameState(state);
  };

  // Teacher presence heartbeat (QISM D/F). Runs only while the teacher panel is
  // active with a live game. If the server stops receiving these, it auto-ends
  // the game after the teacher grace period.
  useHeartbeat(
    async () => {
      if (!gameState?.pin) return;
      await apiPost('/api/teacher-heartbeat', { clientId });
    },
    5000,
    viewMode === 'TEACHER' && isTeacherAuth && !!gameState?.pin
  );

  // Teacher closing the tab/app: a fire-and-forget beacon ends the game right
  // away instead of waiting for the heartbeat grace period. Navigating inside
  // the SPA (e.g. switching to the student view) does NOT fire pagehide, so it
  // never falsely ends a game.
  useEffect(() => {
    if (viewMode !== 'TEACHER' || !isTeacherAuth || !gameState?.pin) return;
    const onPageHide = () => {
      const blob = new Blob([JSON.stringify({ clientId })], { type: 'application/json' });
      navigator.sendBeacon?.('/api/teacher-leave', blob);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [clientId, viewMode, isTeacherAuth, gameState?.pin]);

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
                    {t('change_password_title')}
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    {t('change_password_sub')}
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
                  {t('old_password')}
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
                    placeholder={t('old_password_placeholder')}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showOldPassword ? t('hide') : t('show')}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. Yangi Parol */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
                  {t('new_password')}
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
                    placeholder={t('new_password_placeholder')}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showNewPassword ? t('hide') : t('show')}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 3. Yangi Parolni Takrorlash */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
                  {t('confirm_password')}
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
                    placeholder={t('confirm_password_placeholder')}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono text-sm focus:outline-none focus:border-[#FBBF24] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    title={showConfirmPassword ? t('hide') : t('show')}
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
                  {t('cancel')}
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#FBBF24] hover:bg-[#FCD34D] text-[#0B1121] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  {t('save')}
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
                  <span>{t('back_student')}</span>
                </button>
              </div>

              {/* Lock Icon & Title */}
              <div className="text-center space-y-2 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#0EA5E9]/30 border border-[#0EA5E9]/50 text-[#0EA5E9] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(14,165,233,0.3)] font-black">
                  <Lock className="w-8 h-8 text-[#0EA5E9]" />
                </div>
                <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight uppercase">
                  {t('teacher_password')}
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  {t('teacher_password_sub')}
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
                    {t('teacher_password')}
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
                      placeholder={t('enter_password')}
                      className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-black/40 border border-white/10 text-[#F8FAFC] placeholder:text-[#94A3B8] font-mono font-bold text-base focus:outline-none focus:border-[#0EA5E9] shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                      title={showPasswordText ? t('hide') : t('show')}
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
                    {t('back')}
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-[#FBBF24] hover:bg-[#FCD34D] text-[#0B1121] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    {t('login')}
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
                clientId={clientId}
                gameState={gameState}
                onResetGame={handleResetGame}
                onCreateGame={handleCreateGame}
                onPinUpdated={handleGameStateChange}
              />
            )}

            {/* STUDENT PANEL (DEFAULT) */}
            {viewMode === 'STUDENT' && (
              <StudentView
                clientId={clientId}
                channel={channel}
                gameState={gameState}
                initialPin={gameState?.pin || ''}
                onTeacherClick={() => setShowTeacherPasswordModal(true)}
                onGameStateChange={handleGameStateChange}
              />
            )}
          </>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="bg-[#0B1121]/80 border-t border-white/5 py-6 text-center text-xs text-[#94A3B8] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <p className="break-words">{t('footer_tag')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[#94A3B8] uppercase tracking-widest text-[11px]">
            <span>Node.js</span>
            <span>Pusher Channels</span>
            <span>Express</span>
            <span>React</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
