import { useState } from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import type { GameMode } from './types';

export interface TicTacToeState {
  board: (string | null)[][];
  currentPlayer: string;
  winner: string | null;
  isDraw: boolean;
  moveCount: number;
}

export interface TicTacToeSession {
  session: WsSession;
  player: string;
  state: TicTacToeState;
}

type SessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting'; mode: GameMode }
  | { status: 'ready'; session: TicTacToeSession; mode: GameMode }
  | { status: 'error'; error: string };

export function useTicTacToeSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  const [state, setState] = useState<SessionState>({
    status: 'selecting-mode',
  });

  const selectMode = (mode: GameMode) => {
    setState({ status: 'connecting', mode });
    fetchWsSessionToken({ game: 'tic-tac-toe', mode, identity })
      .then((session) => {
        setState((prev) => {
          if (prev.status !== 'connecting') return prev;
          return {
            status: 'ready',
            mode,
            session: {
              session,
              player: 'X',
              state: {
                board: [
                  [null, null, null],
                  [null, null, null],
                  [null, null, null],
                ],
                currentPlayer: 'X',
                winner: null,
                isDraw: false,
                moveCount: 0,
              },
            },
          };
        });
      })
      .catch((err) => {
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setState({ status: 'error', error: errorMessage(err) });
      });
  };

  const backToMenu = () => {
    setState({ status: 'selecting-mode' });
  };

  return { state, selectMode, backToMenu };
}
