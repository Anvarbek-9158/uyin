import { useEffect, useRef } from 'react';

// Client presence heartbeat (QISM D / G).
//
// Uses a single self-re-scheduling setTimeout chain (never setInterval) so the
// interval is computed freshly after every tick and ticks never overlap even if
// a POST is slow. On visibilitychange it also fires immediately (both when the
// tab becomes visible again — recovering from background-tab timer throttling —
// and when it is hidden — stamping a fresh lastSeen so a short alt-tab is not
// mistaken for a disconnect). Callers attach a pagehide `sendBeacon` separately
// when they want a final best-effort signal on real unload.
export function useHeartbeat(
  tick: () => Promise<void> | void,
  intervalMs: number,
  enabled: boolean
): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | null = null;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      try {
        await tickRef.current();
      } catch {
        // A failed heartbeat must never break the chain — the next tick or a
        // visibilitychange will retry.
      }
      if (cancelled) return;
      timer = window.setTimeout(run, intervalMs);
    };

    const onVisibility = () => {
      run();
    };

    run();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
