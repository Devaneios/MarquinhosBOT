import {
  serverMessageSchema,
  type RpsClientMessage,
  type RpsPick,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EndScreen, GameHeader } from '../../../components/game-shell/index';
import { colyseusUrl } from '../../../lib/apiBase';
import { cn } from '../../../lib/cn';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../../realtime/useColyseusRoom';
import { PICK_ICONS, PICK_LABEL_KEYS } from '../constants';
import {
  advanceAfterRoundResult,
  applyRpsMessage,
  initialRpsView,
  ROUND_RESULT_DISPLAY_MS,
} from '../rpsMessages';

export function PickButton({
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

export function RpsBoard({
  session,
}: {
  session: { token: string; roomKey: string };
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['rock-paper-scissors', 'common']);
  const [view, setView] = useState(initialRpsView);
  const { playerId, phase, roundState, myPick, roundResult, error } = view;

  const { send, connectionState } = useColyseusRoom(
    'rock-paper-scissors',
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message) setView((current) => applyRpsMessage(current, message));
    },
  );

  useEffect(() => {
    if (phase !== 'round_result') return;
    const timer = setTimeout(
      () => setView(advanceAfterRoundResult),
      ROUND_RESULT_DISPLAY_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  const handlePickSubmit = (pick: RpsPick) => {
    if (myPick || !roundState) return;
    setView((current) => ({ ...current, myPick: pick }));
    send({ type: 'pick', payload: { pick } } satisfies RpsClientMessage);
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
                        {
                          PICK_ICONS[
                            playerId === 'player1'
                              ? roundResult.p1Pick
                              : roundResult.p2Pick
                          ]
                        }
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
                        {
                          PICK_ICONS[
                            playerId === 'player1'
                              ? roundResult.p2Pick
                              : roundResult.p1Pick
                          ]
                        }
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
