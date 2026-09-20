import {useEffect, useState} from 'react';
import {Channel} from 'pusher-js';
import {GameSession} from '../types';
import {StudentView} from '../components/StudentView';
import {sounds} from '../utils/soundEffects';
import {apiGet, getClientId} from '../utils/api';
import {pusher} from '../utils/pusher';

export default function PlayPage() {
  const [clientId] = useState<string>(() => getClientId());
  const [channel, setChannel] = useState<Channel | null>(null);
  const [gameState, setGameState] = useState<GameSession | null>(null);

  useEffect(() => {
    const pin = gameState?.pin;
    if (!pin) return;

    // Students always join the shared public game channel from the standalone
    // join page — there is no teacher console here.
    const channelName = `game-${pin}`;
    const gameChannel = pusher.subscribe(channelName);
    setChannel(gameChannel);

    const onGameState = (state: GameSession) => {
      setGameState(state);
    };

    const onTick = (seconds: number) => {
      setGameState((prev) => (prev ? {...prev, timerSeconds: seconds} : prev));
    };

    const onBetPlaced = () => {
      sounds.playBet();
    };

    let cancelled = false;
    const reconcile = async () => {
      if (cancelled) return;
      try {
        const res = await apiGet<{success: boolean; game?: GameSession}>(
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
    gameChannel.bind('bet_placed', onBetPlaced);
    gameChannel.bind('pusher:subscription_succeeded', reconcile);
    if (gameChannel.subscribed) {
      reconcile();
    }

    return () => {
      cancelled = true;
      gameChannel.unbind('game_state', onGameState);
      gameChannel.unbind('timer_tick', onTick);
      gameChannel.unbind('bet_placed', onBetPlaced);
      gameChannel.unbind('pusher:subscription_succeeded', reconcile);
      setChannel(null);
      pusher.unsubscribe(channelName);
    };
  }, [clientId, gameState?.pin]);

  return (
    <div className="min-h-screen bg-surface text-surface-raised flex flex-col font-sans max-w-full overflow-x-hidden selection:bg-brand-500 selection:text-white">
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <StudentView
          clientId={clientId}
          channel={channel}
          gameState={gameState}
          initialPin={gameState?.pin || ''}
          onGameStateChange={setGameState}
        />
      </main>
    </div>
  );
}
