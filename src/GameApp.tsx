import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Channel } from 'pusher-js';
import { GameSession } from './types';
import { Navbar } from './components/Navbar';
import { TeacherView } from './components/TeacherView';
import { sounds } from './utils/soundEffects';
import { apiPost, apiGet, getClientId, setSessionToken } from './utils/api';
import { pusher, teacherGameChannelName } from './utils/pusher';
import { useHeartbeat } from './utils/useHeartbeat';
import { useLang } from './i18n';
import { Sparkles } from 'lucide-react';

export default function App() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [clientId] = useState<string>(() => getClientId());
  const [channel, setChannel] = useState<Channel | null>(null);
  const [gameState, setGameState] = useState<GameSession | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notification, setNotification] = useState<{ type: string; text: string } | null>(null);

  // Keep sound preference accessible inside Pusher event handlers without re-subscribing
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Teacher Authentication state (single login via the marketing auth form sets
  // sessionStorage.teacher_auth). /game is teacher-console only: an unauthenticated
  // visitor is redirected to the standalone student join page /play.
  const [isTeacherAuth, setIsTeacherAuth] = useState<boolean>(() => {
    return sessionStorage.getItem('teacher_auth') === 'true';
  });

  useEffect(() => {
    if (!isTeacherAuth) {
      navigate('/play', { replace: true });
    }
  }, [isTeacherAuth, navigate]);

  // Subscribe to the teacher-private game channel via Pusher so the teacher gets
  // the full state (question, correct answer, every team's answer). Students join
  // the shared public game channel from the standalone /play page.
  useEffect(() => {
    const pin = gameState?.pin;
    if (!pin) return;

    const channelName = teacherGameChannelName(pin);
    const gameChannel = pusher.subscribe(channelName);
    setChannel(gameChannel);

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
  }, [clientId, gameState?.pin]);

  const gameCreationRef = useRef<Promise<unknown> | null>(null);

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

  // Auto-create game session when teacher mode is active.
  // Guarded against concurrent/repeated calls (dev StrictMode double-mount, fast re-renders)
  useEffect(() => {
    if (isTeacherAuth && !gameState && !gameCreationRef.current) {
      gameCreationRef.current = handleCreateGame().finally(() => {
        gameCreationRef.current = null;
      });
    }
  }, [isTeacherAuth, gameState]);

  const handleTeacherLogout = () => {
    setIsTeacherAuth(false);
    sessionStorage.removeItem('teacher_auth');
    navigate('/play', { replace: true });
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

  // Teacher presence heartbeat. Runs only while the teacher console is active
  // with a live game. If the server stops receiving these, it auto-ends the
  // game after the teacher grace period.
  useHeartbeat(
    async () => {
      if (!gameState?.pin) return;
      await apiPost('/api/teacher-heartbeat', { clientId });
    },
    5000,
    isTeacherAuth && !!gameState?.pin
  );

  // Teacher closing the tab/app: a fire-and-forget beacon ends the game right
  // away instead of waiting for the heartbeat grace period.
  useEffect(() => {
    if (!isTeacherAuth || !gameState?.pin) return;
    const onPageHide = () => {
      const blob = new Blob([JSON.stringify({ clientId })], { type: 'application/json' });
      navigator.sendBeacon?.('/api/teacher-leave', blob);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [clientId, isTeacherAuth, gameState?.pin]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-100 flex flex-col font-sans max-w-full overflow-x-hidden selection:bg-brand-500 selection:text-white">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-slate-950/90 border border-indigo-500/40 rounded-2xl p-4 shadow-card backdrop-blur-xl animate-fade-in flex items-center gap-3 max-w-[calc(100vw-2rem)]">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-white break-words min-w-0">{notification.text}</p>
        </div>
      )}

      {/* Main Top Navigation Bar */}
      <Navbar
        viewMode="TEACHER"
        setViewMode={() => {}}
        pin={gameState?.pin || null}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onResetGame={handleResetGame}
        isTeacherAuth={isTeacherAuth}
        onLogoutTeacher={handleTeacherLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <TeacherView
          clientId={clientId}
          gameState={gameState}
          onResetGame={handleResetGame}
          onCreateGame={handleCreateGame}
          onPinUpdated={(s) => setGameState(s)}
        />
      </main>

      {/* Modern Footer */}
      <footer className="bg-slate-950/80 border-t border-white/5 py-6 text-center text-xs text-slate-400 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <p className="break-words">{t('footer_tag')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 uppercase tracking-widest text-xs">
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
