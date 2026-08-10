import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  EndScreen,
  ErrorScreen,
  GameHeader,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { cn } from '../../lib/cn';
import { useColyseusRoom, type ActivityMessage } from '../shared/useColyseusRoom';
import { useRpsSession } from './useRpsSession';

type RpsPick = 'rock' | 'paper' | 'scissors';

interface RoundResult {
  round: number;
  p1Pick: RpsPick;
  p2Pick: RpsPick;
  winner: string | null;
}

interface RpsState {
  round: number;
  bestOf: number;
  submitted: string[];
  scores: {
    player1: number;
    player2: number;
  };
}

type GamePhase = 'waiting' | 'playing' | 'round_result' | 'match_end';

const PICK_ICONS: Record<RpsPick, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
};

const PICK_LABEL_KEYS: Record<RpsPick, string> = {
  rock: 'pickRock',
  paper: 'pickPaper',
  scissors: 'pickScissors',
};

function PickButton({
  pick,
  onClick,
  disabled,
  isMyPick,
  isOtherPick,
  isWinner,
}: {
  pick: RpsPick;
  onClick: () => void;
  disabled: boolean;
  isMyPick: boolean;
  isOtherPick: boolean;
  isWinner: boolean;
}) {
  const { t } = useTranslation(['rock-paper-scissors', 'common']);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'notch-6 relative flex w-24 flex-col items-center gap-2 border px-4 py-6 transition sm:w-28',
        isMyPick || isOtherPick
          ? 'border-marquinhos-accent bg-marquinhos-accent/20'
          : 'border-marquinhos-border bg-marquinhos-panel hover:border-marquinhos-border-hover disabled:opacity-50',
        isWinner && 'ring-2 ring-marquinhos-accent',
      )}
    >
      <div className="text-4xl sm:text-5xl">{PICK_ICONS[pick]}</div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-marquinhos-text-dim">
        {t(PICK_LABEL_KEYS[pick])}
      </div>
      {isMyPick && (
        <div className="absolute -top-2 right-2 text-[10px] font-bold uppercase text-marquinhos-accent">
          {t('common:you')}
        </div>
      )}
    </button>
  );
}

function RpsBoard({
  session,
}: {
  session: { token: string; roomKey: string };
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['rock-paper-scissors', 'common']);
  const [playerId, setPlayerId] = useState<'player1' | 'player2' | null>(
    null,
  );
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [roundState, setRoundState] = useState<RpsState | null>(null);
  const [myPick, setMyPick] = useState<RpsPick | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'rock-paper-scissors',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as { playerId: 'player1' | 'player2' };
        setPlayerId(payload.playerId);
      } else if (message.type === 'game_start') {
        setPhase('playing');
      } else if (message.type === 'round_state') {
        const payload = message.payload as RpsState;
        setRoundState(payload);
      } else if (message.type === 'round_result') {
        const payload = message.payload as RoundResult;
        setRoundResult(payload);
        setPhase('round_result');
        setMyPick(null);
        setTimeout(() => {
          setRoundState((prev) =>
            prev && prev.round < Math.ceil(payload.round + 1)
              ? { ...prev, round: payload.round + 1 }
              : prev,
          );
          setPhase('playing');
        }, 2000);
      } else if (message.type === 'match_end') {
        setPhase('match_end');
      } else if (message.type === 'error') {
        const payload = message.payload as { message: string };
        setError(payload.message);
      }
    },
  );

  const handlePickSubmit = (pick: RpsPick) => {
    if (myPick || !roundState) return;
    setMyPick(pick);
    send({ type: 'pick', payload: { pick } });
  };

  const isPlayerWinning = useMemo(() => {
    if (!roundState) return false;
    const winsNeeded = Math.floor(roundState.bestOf / 2) + 1;
    return playerId === 'player1'
      ? roundState.scores.player1 >= winsNeeded
      : roundState.scores.player2 >= winsNeeded;
  }, [roundState, playerId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="rock-paper-scissors.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div
          className={cn(
            'notch-8 relative flex w-full max-w-[600px] flex-col gap-6 border border-marquinhos-border bg-[#1c1b1c] px-4 py-6 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:px-6',
            phase === 'match_end' && 'min-h-[320px]',
          )}
        >
          {roundState && playerId && phase !== 'match_end' && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="text-center text-xs uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    {t('score')}
                  </div>
                  <div className="text-center font-pixel text-2xl sm:text-3xl">
                    {playerId === 'player1'
                      ? `${roundState.scores.player1} - ${roundState.scores.player2}`
                      : `${roundState.scores.player2} - ${roundState.scores.player1}`}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-center text-xs uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    {t('round')}
                  </div>
                  <div className="text-center font-pixel text-2xl sm:text-3xl">
                    {roundState.round} / {Math.ceil(roundState.bestOf / 2) + 1}
                  </div>
                </div>
              </div>

              {phase === 'playing' && (
                <div className="flex flex-col gap-4">
                  <div className="text-center text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
                    {t('chooseMove')}
                  </div>
                  <div className="flex justify-center gap-3">
                    {(['rock', 'paper', 'scissors'] as const).map((pick) => (
                      <PickButton
                        key={pick}
                        pick={pick}
                        onClick={() => handlePickSubmit(pick)}
                        disabled={
                          myPick !== null ||
                          roundState.submitted.includes(playerId)
                        }
                        isMyPick={myPick === pick}
                        isOtherPick={false}
                        isWinner={false}
                      />
                    ))}
                  </div>
                  {roundState.submitted.length === 1 && (
                    <div className="text-center text-xs text-marquinhos-text-dim">
                      {t('waitingOpponent')}
                    </div>
                  )}
                </div>
              )}

              {phase === 'round_result' && roundResult && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-around gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl sm:text-5xl">
                        {PICK_ICONS[
                          playerId === 'player1'
                            ? roundResult.p1Pick
                            : roundResult.p2Pick
                        ]}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
                        {t('common:you')}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      {roundResult.winner === null && (
                        <div className="font-pixel text-lg text-marquinhos-accent">
                          {t('draw')}
                        </div>
                      )}
                      {roundResult.winner === playerId && (
                        <div className="font-pixel text-lg text-marquinhos-accent">
                          {t('roundWin')}
                        </div>
                      )}
                      {roundResult.winner &&
                        roundResult.winner !== playerId && (
                        <div className="font-pixel text-lg text-marquinhos-danger">
                          {t('roundLose')}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl sm:text-5xl">
                        {PICK_ICONS[
                          playerId === 'player1'
                            ? roundResult.p2Pick
                            : roundResult.p1Pick
                        ]}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim">
                        {t('opponent')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
                  {error}
                </div>
              )}
            </>
          )}

          {phase === 'match_end' && roundState && playerId && (
            <div className="absolute inset-0">
              <EndScreen
                outcomeKey={isPlayerWinning ? 'outcomeWin' : 'outcomeLose'}
                outcomeNs="rock-paper-scissors"
                onBackToHub={() => navigate('/')}
              />
            </div>
          )}

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {t('common:connectionLost')}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function RpsGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const sessionState = useRpsSession(identity, mode, onAuthInvalid);

  if (sessionState.status === 'selecting-mode') {
    return (
      <ModeSelectScreen
        onBack={() => navigate('/')}
        options={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            onSelect: () => setMode('multi'),
          },
        ]}
      />
    );
  }

  if (sessionState.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="rock-paper-scissors"
      />
    );
  }

  if (sessionState.status === 'error') {
    return (
      <ErrorScreen
        message={sessionState.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  return <RpsBoard session={sessionState.session} />;
}
