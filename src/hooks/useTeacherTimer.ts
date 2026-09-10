import {useEffect, useRef} from 'react';
import {GameSession} from '../types';
import {apiPost} from '../utils/api';

// Client-driven countdown for the answering phase.
//
// The server is stateless on Vercel (no long-running setInterval), so the
// teacher's browser drives the timer: every second it reports the remaining
// seconds via /api/timer-tick and the server relays timer_tick to everyone.
// Extracted from TeacherView so the timer lifecycle lives in one place.
export function useTeacherTimer(clientId: string, gameState: GameSession | null): void {
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
  }, [clientId, gameState?.pin, gameState?.phase, gameState?.isTimerRunning]);
}