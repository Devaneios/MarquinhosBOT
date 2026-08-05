import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { cn } from '../../lib/cn';

type Suit = '♠' | '♥' | '♦' | '♣';

type Card = {
  id: string;
  suit: Suit;
  rank: string;
  value: number;
};

type Player = {
  id: string;
  name: string;
  isLocal: boolean;
  ready: boolean;
  connected: boolean;
  score: number;
  hand: Card[];
};

type Phase = 'setup' | 'lobby' | 'match' | 'summary';

type RoomState = {
  code: string;
  phase: Phase;
  players: Array<Player | null>;
  hostId: string;
  turnSeat: number;
  turnCount: number;
  deck: Card[];
  discardPile: Card[];
  lastAction: string;
  winnerSeat: number | null;
  summary: Array<{ seat: number; player: Player; score: number }>;
};

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS = [
  { rank: 'A', value: 1 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
] as const;

const DEMO_NAMES = ['Nova', 'Mika', 'Rook', 'Kite', 'Echo', 'Rune'];
const WIN_SCORE = 30;
const MAX_TURNS = 24;

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDeck() {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const { rank, value } of RANKS) {
      deck.push({
        id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 6)}`,
        suit,
        rank,
        value,
      });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards(deck: Card[], count: number) {
  return deck.splice(0, count);
}

function nextSeat(players: Array<Player | null>, currentSeat: number) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (currentSeat + offset) % players.length;
    if (players[index]) return index;
  }
  return currentSeat;
}

function aliveSeats(players: Array<Player | null>) {
  return players
    .map((player, seat) => ({ player, seat }))
    .filter((entry): entry is { player: Player; seat: number } =>
      Boolean(entry.player),
    );
}

function seatLabel(seat: number) {
  return ['Bottom', 'Left', 'Top', 'Right'][seat] ?? `Seat ${seat + 1}`;
}

function rotateSummary(summary: RoomState['summary'], localSeat = 0) {
  return summary
    .map((entry) => ({
      ...entry,
      relativeSeat: (entry.seat - localSeat + 4) % 4,
    }))
    .sort((a, b) => a.relativeSeat - b.relativeSeat);
}

function CardFace({ card, selected }: { card: Card; selected?: boolean }) {
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      className={cn(
        'notch-6 flex h-[118px] w-[82px] flex-col justify-between border px-2.5 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition-transform duration-150',
        red
          ? 'border-rose-400/40 bg-rose-950 text-rose-100'
          : 'border-slate-400/30 bg-slate-950 text-slate-100',
        selected
          ? 'scale-[1.04] ring-2 ring-marquinhos-accent ring-offset-2 ring-offset-marquinhos-bg'
          : 'hover:-translate-y-1',
      )}
    >
      <div className="flex items-start justify-between text-left">
        <div className="leading-none">
          <div className="text-[14px] font-bold">{card.rank}</div>
          <div className="text-[11px] opacity-80">{card.suit}</div>
        </div>
        <div className="text-[11px] opacity-70">{card.value}</div>
      </div>
      <div
        className={cn(
          'text-center text-[30px] leading-none',
          red ? 'text-rose-200' : 'text-slate-200',
        )}
      >
        {card.suit}
      </div>
      <div className="flex items-end justify-between text-right text-[10px] opacity-70">
        <div>{card.suit}</div>
        <div>{card.rank}</div>
      </div>
    </div>
  );
}

function PlayerBadge({ player, active }: { player: Player; active: boolean }) {
  return (
    <div
      className={cn(
        'notch-6 min-w-0 border px-3 py-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.18)]',
        player.isLocal
          ? 'border-marquinhos-accent/50 bg-marquinhos-accent/10'
          : 'border-marquinhos-border bg-marquinhos-panel',
        active && 'border-marquinhos-green/70 ring-2 ring-marquinhos-green/40',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-marquinhos-text">
            {player.name}
          </div>
          <div className="text-[11px] text-marquinhos-text-dim">
            {player.isLocal ? 'You' : 'Remote player'} ·{' '}
            {player.connected ? 'Connected' : 'Offline'}
          </div>
        </div>
        <div className="text-right text-[11px] text-marquinhos-text-dim">
          <div>{player.score} pts</div>
          <div>{player.hand.length} cards</div>
        </div>
      </div>
    </div>
  );
}

function SeatShell({
  title,
  occupied,
  active,
  children,
}: {
  title: string;
  occupied?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'notch-8 flex min-h-[128px] flex-col justify-between border bg-marquinhos-panel p-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.22)]',
        occupied
          ? 'border-marquinhos-border'
          : 'border-dashed border-marquinhos-border/70',
        active && 'border-marquinhos-green/70 ring-2 ring-marquinhos-green/35',
      )}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
        <span>{title}</span>
        <span>{occupied ? 'Occupied' : 'Empty'}</span>
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function LobbySeat({ player, seat }: { player: Player | null; seat: number }) {
  return (
    <SeatShell
      title={seatLabel(seat)}
      occupied={Boolean(player)}
      active={player?.isLocal}
    >
      {player ? (
        <div className="flex h-full flex-col justify-between gap-2">
          <div>
            <div className="text-base font-semibold text-marquinhos-text">
              {player.name}
            </div>
            <div className="text-sm text-marquinhos-text-dim">
              {player.isLocal ? 'Host' : 'Player'}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-marquinhos-text-dim">
            <span>{player.ready ? 'Ready' : 'Not ready'}</span>
            <span>{player.connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
          Waiting for a player
        </div>
      )}
    </SeatShell>
  );
}

function HUDStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.26em] text-marquinhos-text-dim">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-marquinhos-text">
        {value}
      </div>
    </div>
  );
}

export function CardsGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const [localName, setLocalName] = useState(
    `Player ${identity.userId.slice(-4)}`,
  );
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);

  const selfSeat = 0;

  const localPlayer = room?.players[selfSeat];
  const activePlayer = room && room.players[room.turnSeat];

  const createRoom = () => {
    const code = roomCode.trim().toUpperCase() || randomCode();
    const selfId = `self-${identity.userId}`;
    setSelectedCardId(null);
    setRoom({
      code,
      phase: 'lobby',
      players: [
        {
          id: selfId,
          name: localName.trim() || 'You',
          isLocal: true,
          ready: false,
          connected: true,
          score: 0,
          hand: [],
        },
        null,
        null,
        null,
      ],
      hostId: selfId,
      turnSeat: 0,
      turnCount: 0,
      deck: [],
      discardPile: [],
      lastAction: 'Room created. Invite up to three more players.',
      winnerSeat: null,
      summary: [],
    });
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const selfId = `self-${identity.userId}`;
    setSelectedCardId(null);
    setRoom({
      code,
      phase: 'lobby',
      players: [
        {
          id: selfId,
          name: localName.trim() || 'You',
          isLocal: true,
          ready: false,
          connected: true,
          score: 0,
          hand: [],
        },
        null,
        null,
        null,
      ],
      hostId: selfId,
      turnSeat: 0,
      turnCount: 0,
      deck: [],
      discardPile: [],
      lastAction: `Joined room ${code}. Waiting for the match to start.`,
      winnerSeat: null,
      summary: [],
    });
  };

  const updatePlayer = (seat: number, updater: (player: Player) => Player) => {
    setRoom((current) => {
      if (!current) return current;
      const player = current.players[seat];
      if (!player) return current;
      const nextPlayers = [...current.players];
      nextPlayers[seat] = updater(player);
      return { ...current, players: nextPlayers };
    });
  };

  const addDemoPlayer = () => {
    setRoom((current) => {
      if (!current) return current;
      const emptySeat = current.players.findIndex(
        (player, index) => index > 0 && !player,
      );
      if (emptySeat === -1) return current;
      const usedNames = current.players
        .filter(Boolean)
        .map((player) => player!.name);
      const name =
        DEMO_NAMES.find((candidate) => !usedNames.includes(candidate)) ??
        `Guest ${emptySeat + 1}`;
      const nextPlayers = [...current.players];
      nextPlayers[emptySeat] = {
        id: randomId('guest'),
        name,
        isLocal: false,
        ready: true,
        connected: true,
        score: 0,
        hand: [],
      };
      return {
        ...current,
        players: nextPlayers,
        lastAction: `${name} joined the room.`,
      };
    });
  };

  const removeDemoPlayer = () => {
    setRoom((current) => {
      if (!current) return current;
      const seats = current.players
        .map((player, seat) => ({ player, seat }))
        .filter((entry) => entry.seat > 0 && entry.player);
      const last = seats.at(-1);
      if (!last?.player) return current;
      const nextPlayers = [...current.players];
      nextPlayers[last.seat] = null;
      return {
        ...current,
        players: nextPlayers,
        lastAction: `${last.player.name} left the room.`,
      };
    });
  };

  const toggleReady = () => {
    updatePlayer(selfSeat, (player) => ({ ...player, ready: !player.ready }));
  };

  const startMatch = () => {
    setRoom((current) => {
      if (!current) return current;
      const occupied = aliveSeats(current.players);
      if (occupied.length < 2) {
        return { ...current, lastAction: 'Need at least 2 players to start.' };
      }

      const deck = createDeck();
      const players = current.players.map((player) => {
        if (!player) return null;
        return { ...player, score: 0, hand: dealCards(deck, 5), ready: true };
      });
      const turnSeat = players.findIndex(Boolean);
      return {
        ...current,
        phase: 'match',
        players,
        turnSeat: turnSeat === -1 ? 0 : turnSeat,
        turnCount: 0,
        deck,
        discardPile: [],
        lastAction: `Match started in room ${current.code}. ${players[turnSeat === -1 ? 0 : turnSeat]?.name ?? 'Player'} begins.`,
        winnerSeat: null,
        summary: [],
      };
    });
    setSelectedCardId(null);
  };

  const playCard = (cardId: string) => {
    setRoom((current) => {
      if (!current || current.phase !== 'match') return current;
      const player = current.players[current.turnSeat];
      if (!player || !player.isLocal) return current;
      const cardIndex = player.hand.findIndex((card) => card.id === cardId);
      if (cardIndex === -1) return current;
      const card = player.hand[cardIndex];
      const nextHand = player.hand.filter((entry) => entry.id !== cardId);
      const nextPlayers = [...current.players];
      nextPlayers[current.turnSeat] = {
        ...player,
        hand: nextHand,
        score: player.score + card.value,
      };
      const nextDiscard = [card, ...current.discardPile].slice(0, 12);
      const nextTurnCount = current.turnCount + 1;
      const nextTurnSeat = nextSeat(nextPlayers, current.turnSeat);
      const nextLog = `${player.name} played ${card.rank}${card.suit} for ${card.value} points.`;
      const maybeWinner = resolveWinner(
        nextPlayers,
        nextDiscard,
        nextTurnCount,
      );
      if (maybeWinner !== null) {
        return finishMatch(
          current,
          nextPlayers,
          nextDiscard,
          nextLog,
          nextTurnCount,
          maybeWinner,
        );
      }
      return {
        ...current,
        players: nextPlayers,
        discardPile: nextDiscard,
        turnSeat: nextTurnSeat,
        turnCount: nextTurnCount,
        lastAction: nextLog,
      };
    });
    setSelectedCardId(null);
  };

  const drawCard = () => {
    setRoom((current) => {
      if (!current || current.phase !== 'match') return current;
      const player = current.players[current.turnSeat];
      if (!player) return current;
      if (!current.deck.length) return current;
      const [card, ...rest] = current.deck;
      const nextPlayers = [...current.players];
      nextPlayers[current.turnSeat] = {
        ...player,
        hand: [...player.hand, card],
      };
      const nextTurnCount = current.turnCount + 1;
      const nextTurnSeat = nextSeat(nextPlayers, current.turnSeat);
      const nextLog = `${player.name} drew a card.`;
      const maybeWinner = resolveWinner(
        nextPlayers,
        current.discardPile,
        nextTurnCount,
      );
      if (maybeWinner !== null) {
        return finishMatch(
          current,
          nextPlayers,
          current.discardPile,
          nextLog,
          nextTurnCount,
          maybeWinner,
          rest,
        );
      }
      return {
        ...current,
        players: nextPlayers,
        deck: rest,
        turnSeat: nextTurnSeat,
        turnCount: nextTurnCount,
        lastAction: nextLog,
      };
    });
  };

  const passTurn = () => {
    setRoom((current) => {
      if (!current || current.phase !== 'match') return current;
      const player = current.players[current.turnSeat];
      if (!player) return current;
      const nextTurnCount = current.turnCount + 1;
      const nextTurnSeat = nextSeat(current.players, current.turnSeat);
      const nextLog = `${player.name} passed the turn.`;
      const maybeWinner = resolveWinner(
        current.players,
        current.discardPile,
        nextTurnCount,
      );
      if (maybeWinner !== null) {
        return finishMatch(
          current,
          current.players,
          current.discardPile,
          nextLog,
          nextTurnCount,
          maybeWinner,
        );
      }
      return {
        ...current,
        turnSeat: nextTurnSeat,
        turnCount: nextTurnCount,
        lastAction: nextLog,
      };
    });
  };

  const resetToLobby = () => {
    setRoom((current) => {
      if (!current) return current;
      return {
        ...current,
        phase: 'lobby',
        players: current.players.map((player) =>
          player
            ? {
                ...player,
                score: 0,
                hand: [],
                ready: player.isLocal ? false : true,
              }
            : null,
        ),
        deck: [],
        discardPile: [],
        turnSeat: 0,
        turnCount: 0,
        winnerSeat: null,
        summary: [],
        lastAction: 'Returned to lobby. Ready for another round.',
      };
    });
    setSelectedCardId(null);
  };

  const leaveRoom = () => {
    setRoom(null);
    setJoinCode('');
    setSelectedCardId(null);
  };

  const copyRoomCode = async () => {
    if (!room?.code || !navigator.clipboard) return;
    await navigator.clipboard.writeText(room.code);
  };

  useEffect(() => {
    if (!room || room.phase !== 'match') return;
    if (!room.players[room.turnSeat] || room.players[room.turnSeat]?.isLocal)
      return;

    const handle = window.setTimeout(() => {
      setRoom((current) => {
        if (!current || current.phase !== 'match') return current;
        const player = current.players[current.turnSeat];
        if (!player || player.isLocal) return current;

        const nextPlayers = [...current.players];
        const actionRoll = Math.random();
        let nextDeck = current.deck;
        let nextDiscard = [...current.discardPile];
        let nextLog = `${player.name} considered their move.`;

        if (actionRoll < 0.45 && player.hand.length > 0) {
          const chosen = [...player.hand].sort((a, b) => b.value - a.value)[0];
          const nextHand = player.hand.filter((card) => card.id !== chosen.id);
          nextPlayers[current.turnSeat] = {
            ...player,
            hand: nextHand,
            score: player.score + chosen.value,
          };
          nextDiscard = [chosen, ...nextDiscard].slice(0, 12);
          nextLog = `${player.name} played ${chosen.rank}${chosen.suit}.`;
        } else if (nextDeck.length > 0) {
          const [card, ...rest] = nextDeck;
          nextDeck = rest;
          nextPlayers[current.turnSeat] = {
            ...player,
            hand: [...player.hand, card],
          };
          nextLog = `${player.name} drew a card.`;
        } else {
          nextLog = `${player.name} passed.`;
        }

        const nextTurnCount = current.turnCount + 1;
        const nextTurnSeat = nextSeat(nextPlayers, current.turnSeat);
        const maybeWinner = resolveWinner(
          nextPlayers,
          nextDiscard,
          nextTurnCount,
        );
        if (maybeWinner !== null) {
          return finishMatch(
            current,
            nextPlayers,
            nextDiscard,
            nextLog,
            nextTurnCount,
            maybeWinner,
            nextDeck,
          );
        }
        return {
          ...current,
          players: nextPlayers,
          deck: nextDeck,
          discardPile: nextDiscard,
          turnSeat: nextTurnSeat,
          turnCount: nextTurnCount,
          lastAction: nextLog,
        };
      });
    }, 900);

    return () => window.clearTimeout(handle);
  }, [room]);

  useEffect(() => {
    if (room?.phase === 'match' && room.turnCount >= MAX_TURNS) {
      setRoom((current) => {
        if (!current || current.phase !== 'match') return current;
        const summary = aliveSeats(current.players)
          .map(({ player, seat }) => ({ seat, player, score: player.score }))
          .sort((a, b) => b.score - a.score);
        return {
          ...current,
          phase: 'summary',
          winnerSeat: summary[0]?.seat ?? null,
          summary,
          lastAction: `${summary[0]?.player.name ?? 'Nobody'} wins the tiebreak!`,
        };
      });
    }
  }, [room]);

  const roomPlayers = room ? aliveSeats(room.players) : [];
  const visibleSummary = room ? rotateSummary(room.summary, selfSeat) : [];

  const onCardKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedCardId(cardId);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_18%),var(--color-marquinhos-bg)] text-marquinhos-text">
      <header className="flex items-center justify-between gap-3 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.22em] text-marquinhos-text-dim transition hover:border-marquinhos-border-hover hover:text-marquinhos-text"
          >
            Back
          </button>
          <div className="min-w-0">
            <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent">
              CARD TABLE
            </div>
            <div className="text-sm text-marquinhos-text-dim">
              Multiplayer table for up to 4 players per room.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onAuthInvalid}
            className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition hover:border-marquinhos-border-hover hover:text-marquinhos-text"
          >
            Retry auth
          </button>
          {room && (
            <>
              <HUDStat label="Room" value={room.code} />
              <HUDStat label="Phase" value={room.phase.toUpperCase()} />
              <HUDStat label="Players" value={`${roomPlayers.length}/4`} />
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        {!room && (
          <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-6 shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-marquinhos-border bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-marquinhos-text-dim">
                    2–4 players · realtime room UI
                  </div>
                  <div className="space-y-3">
                    <h1 className="font-pixel text-3xl leading-tight tracking-[0.28em] text-marquinhos-accent sm:text-4xl">
                      PILE & SPOT
                    </h1>
                    <p className="max-w-[58ch] text-sm leading-6 text-marquinhos-text-dim sm:text-base">
                      A complete retro card-table interface for a Discord
                      Activity. Create or join a room, fill up to four seats,
                      and play through a turn-based match with visible table
                      state, player panels, and endgame results.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                        Seats
                      </div>
                      <div className="mt-1 text-lg font-semibold">4 max</div>
                    </div>
                    <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                        Modes
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        Lobby · Match
                      </div>
                    </div>
                    <div className="notch-6 border border-marquinhos-border bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                        Layout
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        Responsive table
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={createRoom}
                    className="notch-8 border border-marquinhos-accent/60 bg-marquinhos-accent px-4 py-4 text-left font-semibold text-black transition hover:bg-marquinhos-accent-hover"
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] opacity-80">
                      Create room
                    </div>
                    <div className="mt-1 text-base">Start a new table</div>
                  </button>
                  <div className="notch-8 border border-marquinhos-border bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                      Join room
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={joinCode}
                        onChange={(event) =>
                          setJoinCode(event.target.value.toUpperCase())
                        }
                        placeholder="ABCD"
                        maxLength={8}
                        className="notch-6 min-w-0 flex-1 border border-marquinhos-border bg-marquinhos-bg px-3 py-3 text-sm uppercase tracking-[0.2em] outline-none placeholder:text-marquinhos-text-disabled focus:border-marquinhos-border-hover"
                      />
                      <button
                        type="button"
                        onClick={joinRoom}
                        className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-3 text-sm uppercase tracking-[0.18em] text-marquinhos-text transition hover:border-marquinhos-border-hover"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
              <div className="space-y-4">
                <div>
                  <div className="font-pixel text-sm tracking-[0.22em] text-marquinhos-text">
                    PLAYER SETUP
                  </div>
                  <p className="mt-2 text-sm text-marquinhos-text-dim">
                    Set your display name before entering the room. It will
                    appear in the lobby and on the table.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    Display name
                  </span>
                  <input
                    value={localName}
                    onChange={(event) => setLocalName(event.target.value)}
                    className="notch-6 w-full border border-marquinhos-border bg-marquinhos-bg px-3 py-3 text-sm outline-none placeholder:text-marquinhos-text-disabled focus:border-marquinhos-border-hover"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                    Room code
                  </span>
                  <input
                    value={roomCode}
                    onChange={(event) =>
                      setRoomCode(event.target.value.toUpperCase())
                    }
                    placeholder="Optional for create room"
                    maxLength={8}
                    className="notch-6 w-full border border-marquinhos-border bg-marquinhos-bg px-3 py-3 text-sm uppercase tracking-[0.2em] outline-none placeholder:text-marquinhos-text-disabled focus:border-marquinhos-border-hover"
                  />
                </label>
                <div className="rounded-[18px] border border-marquinhos-border bg-black/20 p-4 text-sm leading-6 text-marquinhos-text-dim">
                  This UI is built to plug into a real room backend later, but
                  it already demonstrates the full 2–4 player flow: lobby, seat
                  management, turn-based play, and end-of-match results.
                </div>
              </div>
            </aside>
          </div>
        )}

        {room && room.phase === 'lobby' && (
          <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1fr_320px]">
            <section className="flex min-h-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-pixel text-xl tracking-[0.22em] text-marquinhos-accent">
                    LOBBY
                  </div>
                  <div className="mt-2 text-sm text-marquinhos-text-dim">
                    Room{' '}
                    <span className="text-marquinhos-text">{room.code}</span> ·
                    Waiting for up to 4 players
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyRoomCode}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition hover:border-marquinhos-border-hover hover:text-marquinhos-text"
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={leaveRoom}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim transition hover:border-marquinhos-border-hover hover:text-marquinhos-text"
                  >
                    Leave
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
                {room.players.map((player, seat) => (
                  <LobbySeat key={seat} player={player} seat={seat} />
                ))}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col gap-4">
              <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Actions
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={toggleReady}
                    className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
                  >
                    {localPlayer?.ready ? 'Unready' : 'Ready up'}
                  </button>
                  <button
                    type="button"
                    onClick={addDemoPlayer}
                    disabled={room.players.filter(Boolean).length >= 4}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add demo player
                  </button>
                  <button
                    type="button"
                    onClick={removeDemoPlayer}
                    disabled={room.players.filter(Boolean).length <= 1}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove demo player
                  </button>
                  <button
                    type="button"
                    onClick={startMatch}
                    disabled={room.players.filter(Boolean).length < 2}
                    className="notch-6 border border-marquinhos-green/60 bg-marquinhos-green px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start match
                  </button>
                </div>
              </div>

              <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4 text-sm text-marquinhos-text-dim">
                <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Room notes
                </div>
                <ul className="mt-3 space-y-2 leading-6">
                  <li>
                    • Seats are fixed to 4 slots, with the local player anchored
                    to the bottom.
                  </li>
                  <li>
                    • Empty seats remain visible so the room state is always
                    readable.
                  </li>
                  <li>
                    • Start is enabled once at least 2 players are present.
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        )}

        {room && room.phase === 'match' && (
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_340px]">
            <section className="flex min-h-0 flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HUDStat
                  label="Turn"
                  value={activePlayer ? activePlayer.name : '—'}
                />
                <HUDStat
                  label="Round"
                  value={`${room.turnCount + 1}/${MAX_TURNS}`}
                />
                <HUDStat label="Deck" value={`${room.deck.length} cards`} />
                <HUDStat
                  label="Discard"
                  value={`${room.discardPile.length} cards`}
                />
              </div>

              <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden rounded-[28px] border border-marquinhos-border bg-[radial-gradient(circle_at_center,_rgba(255,176,0,0.12),_rgba(0,0,0,0.05)_40%,_rgba(0,0,0,0.08)_68%,_rgba(0,0,0,0.15)),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-marquinhos-accent/20" />
                  <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-marquinhos-border/60" />
                </div>

                <div className="relative grid flex-1 grid-cols-3 grid-rows-3 gap-3">
                  <div className="col-span-3 flex justify-center">
                    {room.players[2] ? (
                      <div className="w-full max-w-[380px]">
                        <PlayerBadge
                          player={room.players[2] as Player}
                          active={room.turnSeat === 2}
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[380px]">
                        <SeatShell title="Top" occupied={false}>
                          <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
                            Empty seat
                          </div>
                        </SeatShell>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-start">
                    {room.players[1] ? (
                      <div className="w-full max-w-[220px]">
                        <PlayerBadge
                          player={room.players[1] as Player}
                          active={room.turnSeat === 1}
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[220px]">
                        <SeatShell title="Left" occupied={false}>
                          <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
                            Empty
                          </div>
                        </SeatShell>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="relative z-10 flex h-full w-full max-w-[260px] flex-col items-center justify-center gap-3">
                      <div className="notch-8 border border-marquinhos-border bg-black/35 px-4 py-3 text-center shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                          Table center
                        </div>
                        <div className="mt-1 text-sm font-semibold text-marquinhos-text">
                          {room.lastAction}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                            Deck
                          </div>
                          <div className="mt-1 text-xl font-semibold text-marquinhos-accent">
                            {room.deck.length}
                          </div>
                        </div>
                        <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-3 text-center">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                            Discard
                          </div>
                          <div className="mt-1 text-xl font-semibold text-marquinhos-text">
                            {room.discardPile[0]
                              ? `${room.discardPile[0].rank}${room.discardPile[0].suit}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    {room.players[3] ? (
                      <div className="w-full max-w-[220px]">
                        <PlayerBadge
                          player={room.players[3] as Player}
                          active={room.turnSeat === 3}
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[220px]">
                        <SeatShell title="Right" occupied={false}>
                          <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
                            Empty
                          </div>
                        </SeatShell>
                      </div>
                    )}
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <div className="w-full max-w-[420px]">
                      <PlayerBadge
                        player={room.players[0] as Player}
                        active={room.turnSeat === 0}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="flex min-h-0 flex-col gap-4">
              <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                      Your hand
                    </div>
                    <div className="mt-1 text-sm text-marquinhos-text-dim">
                      Play a card, draw, or pass. Opponents take their turns
                      automatically.
                    </div>
                  </div>
                  <div className="rounded-full border border-marquinhos-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-marquinhos-text-dim">
                    {room.players[room.turnSeat]?.isLocal
                      ? 'Your turn'
                      : 'Waiting'}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {localPlayer?.hand.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(event) => onCardKeyDown(event, card.id)}
                      className="focus-visible:outline-none"
                    >
                      <CardFace
                        card={card}
                        selected={selectedCardId === card.id}
                      />
                    </button>
                  ))}
                  {!localPlayer?.hand.length && (
                    <div className="rounded-[18px] border border-dashed border-marquinhos-border px-4 py-8 text-sm text-marquinhos-text-disabled">
                      Your hand is empty.
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => selectedCardId && playCard(selectedCardId)}
                    disabled={
                      !room.players[room.turnSeat]?.isLocal || !selectedCardId
                    }
                    className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Play selected
                  </button>
                  <button
                    type="button"
                    onClick={drawCard}
                    disabled={
                      !room.players[room.turnSeat]?.isLocal ||
                      room.deck.length === 0
                    }
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    onClick={passTurn}
                    disabled={!room.players[room.turnSeat]?.isLocal}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Pass
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {room.players.map((player, seat) =>
                  player ? (
                    <SeatShell
                      key={seat}
                      title={seatLabel(seat)}
                      occupied
                      active={room.turnSeat === seat}
                    >
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-marquinhos-text">
                          {player.name}
                        </div>
                        <div className="text-marquinhos-text-dim">
                          Score: {player.score}
                        </div>
                        <div className="text-marquinhos-text-dim">
                          {player.hand.length} cards in hand
                        </div>
                      </div>
                    </SeatShell>
                  ) : (
                    <SeatShell
                      key={seat}
                      title={seatLabel(seat)}
                      occupied={false}
                    >
                      <div className="flex h-full items-center justify-center text-sm text-marquinhos-text-disabled">
                        Open seat
                      </div>
                    </SeatShell>
                  ),
                )}
              </div>
            </aside>
          </div>
        )}

        {room && room.phase === 'summary' && (
          <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1fr_360px]">
            <section className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-6">
              <div className="space-y-3">
                <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-accent">
                  MATCH END
                </div>
                <div className="text-sm text-marquinhos-text-dim">
                  Room {room.code} · {room.lastAction}
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {visibleSummary.map((entry, index) => (
                  <div
                    key={entry.seat}
                    className={cn(
                      'notch-6 flex items-center justify-between border px-4 py-3',
                      index === 0
                        ? 'border-marquinhos-green/60 bg-marquinhos-green/10'
                        : 'border-marquinhos-border bg-black/15',
                    )}
                  >
                    <div>
                      <div className="text-base font-semibold text-marquinhos-text">
                        {index + 1}. {entry.player.name}
                      </div>
                      <div className="text-sm text-marquinhos-text-dim">
                        Seat {seatLabel(entry.seat)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-marquinhos-text">
                        {entry.score}
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-marquinhos-text-dim">
                        points
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col gap-4">
              <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Winner
                </div>
                <div className="mt-2 text-2xl font-semibold text-marquinhos-accent">
                  {room.winnerSeat !== null
                    ? (room.players[room.winnerSeat]?.name ?? 'Unknown')
                    : 'No winner'}
                </div>
                <div className="mt-2 text-sm text-marquinhos-text-dim">
                  Final score:{' '}
                  {room.winnerSeat !== null
                    ? (room.players[room.winnerSeat]?.score ?? 0)
                    : 0}
                </div>
              </div>

              <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Actions
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={resetToLobby}
                    className="notch-6 border border-marquinhos-green/60 bg-marquinhos-green px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110"
                  >
                    Play again
                  </button>
                  <button
                    type="button"
                    onClick={leaveRoom}
                    className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-3 text-sm transition hover:border-marquinhos-border-hover"
                  >
                    Return to hub
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {import.meta.env.DEV && (
        <div className="border-t border-marquinhos-border bg-black/15 px-4 py-2 text-[11px] text-marquinhos-text-dim">
          DEV · {room ? `${room.phase} / ${room.code}` : 'setup'}
        </div>
      )}
    </div>
  );

  function resolveWinner(
    players: Array<Player | null>,
    discardPile: Card[],
    turnCount: number,
  ) {
    const occupied = aliveSeats(players);
    const scores = occupied.map(({ player, seat }) => ({
      seat,
      player,
      score: player.score,
    }));
    const maxScore = Math.max(...scores.map((entry) => entry.score), 0);
    if (maxScore >= WIN_SCORE) {
      return scores.sort((a, b) => b.score - a.score)[0]?.seat ?? null;
    }
    if (turnCount >= MAX_TURNS) {
      return scores.sort((a, b) => b.score - a.score)[0]?.seat ?? null;
    }
    const noCardsLeft =
      players.every((player) => !player || player.hand.length === 0) &&
      discardPile.length > 0;
    if (noCardsLeft) {
      return scores.sort((a, b) => b.score - a.score)[0]?.seat ?? null;
    }
    return null;
  }

  function finishMatch(
    current: RoomState,
    players: Array<Player | null>,
    discardPile: Card[],
    lastAction: string,
    turnCount: number,
    winnerSeat: number | null,
    deckOverride?: Card[],
  ) {
    const summary = aliveSeats(players)
      .map(({ player, seat }) => ({ seat, player, score: player.score }))
      .sort((a, b) => b.score - a.score);
    return {
      ...current,
      phase: 'summary' as const,
      players,
      deck: deckOverride ?? current.deck,
      discardPile,
      turnCount,
      winnerSeat,
      summary,
      lastAction,
    };
  }
}
