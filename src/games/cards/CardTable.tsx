import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConnectingScreen, ErrorScreen } from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import type { WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { CardBack, CardFace } from './components/CardFace';
import { PlayerBadge } from './components/PlayerBadge';
import { SeatShell } from './components/SeatShell';
import {
  isHiddenCard,
  type DisconnectNotice,
  type LegalMove,
  type MaskedCard,
  type RestartStatus,
  type ScoreboardEntry,
  type TableView,
} from './core/types';
import {
  moveLabel,
  presentationFor,
  seatLabel,
  titleKeyFor,
  type RulesetPresentation,
  type Translate,
} from './rulesets/presentation';
import { useCardTableSession } from './useCardTableSession';

// The generic table: it renders whatever masked state the server pushes and
// whichever moves the server says are legal. It knows no rules — everything
// game-specific comes from `presentation`, keyed by ruleset id.
function CardTableBoard({
  session,
  ruleset,
}: {
  session: WsSession;
  ruleset: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['cards', 'common']);
  const presentation = presentationFor(ruleset, t);
  const [view, setView] = useState<TableView | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[] | null>(null);
  const [restartStatus, setRestartStatus] = useState<RestartStatus | null>(null);
  const [restartRequested, setRestartRequested] = useState(false);
  const [disconnected, setDisconnected] = useState<DisconnectNotice | null>(
    null,
  );
  const [timedOut, setTimedOut] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'cards',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      switch (message.type) {
        case 'init':
          setMySeatIndex(
            (message.payload as { seatIndex: number | null }).seatIndex,
          );
          break;
        case 'state': {
          setView(message.payload as TableView);
          setRejection(null);
          setTimedOut(null);
          // Only drop the selection when the card is no longer playable —
          // clearing it on every broadcast means an opponent's move wipes the
          // card you were about to play.
          const next = message.payload as TableView;
          setSelectedCardId((current) =>
            current && isPlayable(next.legalMoves, current) ? current : null,
          );
          break;
        }
        case 'move_rejected':
          setRejection(
            (message.payload as { reason?: string })?.reason ??
              t('cards:invalidMove'),
          );
          break;
        case 'match_over':
          setScoreboard(
            (message.payload as { scoreboard: ScoreboardEntry[] }).scoreboard,
          );
          break;
        case 'restart_status':
          setRestartStatus(message.payload as RestartStatus);
          break;
        case 'opponent_disconnected':
          setDisconnected(message.payload as DisconnectNotice);
          break;
        case 'opponent_reconnected':
          setDisconnected(null);
          break;
        case 'turn_timeout':
          setTimedOut((message.payload as { userId: string }).userId);
          break;
        default:
          break;
      }
    },
  );

  function sendMove(move: string, args?: unknown) {
    send({ type: 'move', payload: { move, args } });
  }

  function requestRestart() {
    setRestartRequested(true);
    send({ type: 'restart' });
  }

  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[200px] w-full max-w-[480px] flex-col items-center justify-center gap-3 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            {t('cards:waitingTable')}
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            {t('cards:waitingTableSubtitle')}
          </div>
        </div>
      </div>
    );
  }

  const spectating = mySeatIndex === null;
  const myHand = mySeatIndex !== null ? view.hands[mySeatIndex] : undefined;
  const playCardMoves = view.legalMoves.filter((m) => m.move === 'play_card');
  const otherMoves = view.legalMoves.filter((m) => m.move !== 'play_card');
  const canPlaySelected =
    selectedCardId !== null && isPlayable(view.legalMoves, selectedCardId);
  const statusLine = presentation.statusLine?.(view) ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_18%),var(--color-marquinhos-bg)] text-marquinhos-text">
      {/*
        Not a <GameHeader>: presentation.title is a fully-resolved translated
        string (built via t() in rulesets/presentation.tsx), not a lookup key,
        so it can't go through GameHeader's titleKey/titleNs contract. This
        copies GameHeader's "bar" variant markup/classNames exactly to stay
        visually identical while rendering the resolved title directly.
      */}
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
            {presentation.title}
          </div>
          {spectating && (
            <div className="notch-6 border border-marquinhos-border px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-marquinhos-text-dim">
              {t('cards:spectatingBadge')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {presentation.hud?.(view)}
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={() => navigate('/')}
          >
            {t('common:back')}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(view.seats.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {view.seats.map((seat) => (
            <SeatShell
              key={seat.seatIndex}
              title={seatLabel(presentation, seat.seatIndex, t)}
              occupied={Boolean(seat.playerId)}
              active={view.currentSeat === seat.seatIndex}
            >
              {seat.playerId ? (
                <div className="flex flex-col gap-2">
                  <PlayerBadge
                    name={seat.playerId}
                    subtitle={
                      seat.teamId
                        ? t('cards:teamWithId', { team: seat.teamId })
                        : t('cards:playerLabel')
                    }
                    meta={handMeta(view.hands[seat.seatIndex]?.count, t)}
                    isLocal={seat.seatIndex === mySeatIndex}
                    active={view.currentSeat === seat.seatIndex}
                  />
                  {disconnected?.seatIndex === seat.seatIndex && (
                    <div className="text-[10px] uppercase tracking-[0.18em] text-marquinhos-danger">
                      {t('cards:disconnectedLabel')}
                    </div>
                  )}
                  {timedOut === seat.playerId && (
                    <div className="text-[10px] uppercase tracking-[0.18em] text-marquinhos-text-dim">
                      {t('cards:timeoutLabel')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
                  {t('cards:waitingPlayerSeat')}
                </div>
              )}
            </SeatShell>
          ))}
        </div>

        <div className="notch-8 flex min-h-[140px] flex-1 items-center justify-center gap-3 border border-marquinhos-border bg-black/20 p-4">
          {view.table.length === 0 && (
            <div className="text-sm text-marquinhos-text-disabled">
              {t('cards:emptyTable')}
            </div>
          )}
          {view.table.map((played) => (
            <div
              key={played.seatIndex}
              className="flex flex-col items-center gap-1"
            >
              <CardFace card={played.card} />
              <div className="text-[10px] uppercase tracking-[0.2em] text-marquinhos-text-dim">
                {seatLabel(presentation, played.seatIndex, t)}
              </div>
            </div>
          ))}
        </div>

        {statusLine && (
          <div className="notch-6 border border-marquinhos-accent/40 bg-marquinhos-accent/10 p-3 text-sm text-marquinhos-text">
            {statusLine}
          </div>
        )}

        {disconnected && (
          <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-sm text-marquinhos-danger">
            {t('cards:disconnectNotice', {
              seconds: Math.round(disconnected.timeoutMs / 1000),
            })}
          </div>
        )}

        <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
            {spectating ? t('cards:tableLabel') : t('cards:yourHandLabel')}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(myHand?.cards.length ?? 0) === 0 && (
              <div className="text-sm text-marquinhos-text-disabled">
                {spectating
                  ? t('cards:spectatingNotice')
                  : t('cards:noCards')}
              </div>
            )}
            {(myHand?.cards ?? []).map((card, index) => (
              <HandCard
                key={cardKey(card, index)}
                card={card}
                playable={
                  !isHiddenCard(card) && isPlayable(view.legalMoves, card.id)
                }
                selected={!isHiddenCard(card) && selectedCardId === card.id}
                onSelect={() =>
                  !isHiddenCard(card) && setSelectedCardId(card.id)
                }
              />
            ))}
          </div>

          {!spectating && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canPlaySelected}
                onClick={() =>
                  selectedCardId &&
                  sendMove('play_card', { cardId: selectedCardId })
                }
                className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('cards:playSelectedCard')}
              </button>
              {otherMoves.map((legalMove) => (
                <button
                  key={legalMove.move}
                  type="button"
                  onClick={() => sendMove(legalMove.move, legalMove.args)}
                  className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover"
                >
                  {moveLabel(presentation, legalMove.move)}
                </button>
              ))}
              {playCardMoves.length === 0 && otherMoves.length === 0 && (
                <div className="py-3 text-sm text-marquinhos-text-dim">
                  {t('cards:waitingOthers')}
                </div>
              )}
            </div>
          )}

          {rejection && (
            <div className="notch-6 mt-4 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-sm text-marquinhos-danger">
              {rejection}
            </div>
          )}

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 mt-4 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-sm text-marquinhos-danger">
              {t('common:connectionLost')}
            </div>
          )}
        </div>
      </main>

      {scoreboard && (
        <MatchOverOverlay
          scoreboard={scoreboard}
          presentation={presentation}
          view={view}
          spectating={spectating}
          restartStatus={restartStatus}
          restartRequested={restartRequested}
          onRestart={requestRestart}
          onBack={() => navigate('/')}
        />
      )}
    </div>
  );
}

function isPlayable(legalMoves: LegalMove[], cardId: string): boolean {
  return legalMoves.some(
    (m) =>
      m.move === 'play_card' &&
      (m.args as { cardId?: string } | undefined)?.cardId === cardId,
  );
}

function cardKey(card: MaskedCard, index: number): string {
  return isHiddenCard(card) ? `hidden-${index}` : card.id;
}

function handMeta(
  count: number | undefined,
  t: Translate,
): string | undefined {
  if (count === undefined) return undefined;
  return t('cards:cardCount', { count });
}

function HandCard({
  card,
  playable,
  selected,
  onSelect,
}: {
  card: MaskedCard;
  playable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  if (isHiddenCard(card)) return <CardBack />;
  return (
    <button
      type="button"
      disabled={!playable}
      onClick={onSelect}
      className={playable ? '' : 'opacity-50'}
    >
      <CardFace card={card} selected={selected} />
    </button>
  );
}

// Without this, a finished match just froze: the table stopped accepting moves
// with nothing on screen to say why, and the server's restart voting had no way
// to be triggered at all.
function MatchOverOverlay({
  scoreboard,
  presentation,
  view,
  spectating,
  restartStatus,
  restartRequested,
  onRestart,
  onBack,
}: {
  scoreboard: ScoreboardEntry[];
  presentation: RulesetPresentation;
  view: TableView;
  spectating: boolean;
  restartStatus: RestartStatus | null;
  restartRequested: boolean;
  onRestart: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation(['cards', 'common']);
  const winners = scoreboard.filter((entry) => entry.position === 1);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
      <div className="notch-8 flex w-full max-w-[520px] flex-col items-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.32)]">
        <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
          {t('cards:matchOverTitle')}
        </div>
        <div className="flex flex-col gap-1 text-sm text-marquinhos-text">
          <div className="text-marquinhos-text-dim">
            {t('cards:winnersLabel')}
          </div>
          {winners.map((entry) => (
            <div key={entry.userId} className="font-semibold">
              {entry.points !== undefined
                ? t('cards:scoreboardEntryWithPoints', {
                    name: entry.userId,
                    points: entry.points,
                  })
                : entry.userId}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {presentation.hud?.(view)}
        </div>
        {restartStatus && (
          <div className="text-sm text-marquinhos-text-dim">
            {t('cards:rematchVotes', {
              votes: restartStatus.votes,
              required: restartStatus.required,
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!spectating && (
            <button
              type="button"
              disabled={restartRequested && restartStatus === null}
              onClick={onRestart}
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restartRequested
                ? t('cards:waitingRematch')
                : t('cards:playAgainButton')}
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
          >
            {t('common:backToHub')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CardTable({
  identity,
  onAuthInvalid,
  ruleset,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
  // Which pluggable server-side GameDefinition this table plays. Comes from the
  // route rather than being hardcoded, so a second ruleset needs no new screen.
  ruleset: string;
}) {
  const navigate = useNavigate();
  const session = useCardTableSession(identity, ruleset, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen subtitleKey={titleKeyFor(ruleset)} subtitleNs="cards" />
    );
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <CardTableBoard session={session.session} ruleset={ruleset} />
    </div>
  );
}
